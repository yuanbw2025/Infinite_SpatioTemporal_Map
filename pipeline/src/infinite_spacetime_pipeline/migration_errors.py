"""Shared migration failures without creating module import cycles."""


class MigrationError(ValueError):
    """Raised when an old value cannot be migrated without inventing facts."""
