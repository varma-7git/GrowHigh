from rest_framework.permissions import BasePermission

from .constants import ReviewStatus, Role


class _HasRole(BasePermission):
    roles: tuple = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.roles)


class IsStudent(_HasRole):
    roles = (Role.STUDENT,)


class IsFaculty(_HasRole):
    roles = (Role.FACULTY,)


class IsAdmin(_HasRole):
    roles = (Role.ADMIN,)


class IsCompany(_HasRole):
    roles = (Role.COMPANY,)


class IsApprovedCompany(BasePermission):
    """A company can act only after the admin approved it."""

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated and u.role == Role.COMPANY):
            return False
        profile = getattr(u, "company_profile", None)
        return bool(profile and profile.status == ReviewStatus.APPROVED)


class IsFacultyOrAdmin(_HasRole):
    roles = (Role.FACULTY, Role.ADMIN)


class IsOwner(BasePermission):
    """Object permission: the logged-in user created the object (created_by)."""

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "created_by_id", None) == request.user.id
