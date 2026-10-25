from django.core.exceptions import ValidationError


class LetterAndNumberValidator:
    """Password must contain at least one letter and one number."""

    def validate(self, password, user=None):
        if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
            raise ValidationError("Password must contain at least one letter and one number.", code="password_no_letter_number")

    def get_help_text(self):
        return "Your password must contain at least one letter and one number."
