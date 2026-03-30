from sc_tool.bootstrap import bootstrap_tk_env
from sc_tool.db import init_db
from sc_tool.importer import ScCraftImporter


def main() -> None:
    bootstrap_tk_env()
    init_db()
    importer = ScCraftImporter(log=print)
    result = importer.full_sync()
    print()
    print(
        f"Synchronisation terminee pour {result.version}: "
        f"{result.imported_blueprints} blueprints locaux, "
        f"dernier ID scanne {result.last_blueprint_id}."
    )


if __name__ == "__main__":
    main()
