from app.db.models import Base


def test_registry_includes_all_models() -> None:
    assert set(Base.metadata.tables) == {"users", "monitors"}
