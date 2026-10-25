from rest_framework.permissions import IsAuthenticated

from .constants import Role
from .permissions import IsAdmin


class AdminWriteMixin:
    """Anyone logged in can read. Only Admin can create, edit or delete."""

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdmin()]
        return [IsAuthenticated()]


class ActiveOnlyForNonAdminMixin:
    """Students and faculty see only active items. Admin can filter with ?is_active=."""

    def filter_active(self, qs):
        user = self.request.user
        if getattr(user, "role", None) != Role.ADMIN:
            return qs.filter(is_active=True)
        value = self.request.query_params.get("is_active")
        if value in ("true", "True", "1"):
            return qs.filter(is_active=True)
        if value in ("false", "False", "0"):
            return qs.filter(is_active=False)
        return qs


class SafeDeleteMixin:
    """DELETE works only when nothing depends on the object; otherwise 409 with a clear reason."""
    delete_hint = "Hide it instead so existing records stay intact."

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        from common.exceptions import Conflict
        obj = self.get_object()
        try:
            obj.delete()
        except ProtectedError:
            raise Conflict(f"This item is linked to other records and cannot be deleted. {self.delete_hint}")
        from rest_framework import status
        from rest_framework.response import Response
        return Response(status=status.HTTP_204_NO_CONTENT)
