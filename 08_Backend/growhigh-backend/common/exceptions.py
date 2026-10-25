"""One error format for every API error: {"detail": "...", "errors": {...}}."""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class Conflict(APIException):
    """409: a business rule blocks the action (second attempt, locked test, duplicate)."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This action conflicts with a rule."
    default_code = "conflict"


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    data = response.data
    if response.status_code == status.HTTP_400_BAD_REQUEST:
        if isinstance(data, list):
            data = {"non_field_errors": data}
        if isinstance(data, dict) and list(data.keys()) != ["detail"]:
            response.data = {"detail": "Validation error", "errors": data}
    elif isinstance(data, dict) and "detail" in data:
        response.data = {"detail": str(data["detail"])}
    return response
