from django.core.management import BaseCommand, CommandError, call_command
from django.db import DEFAULT_DB_ALIAS, connections
from django.db.migrations.loader import MigrationLoader


class Command(BaseCommand):
    help = "Validate that all migrations can be applied cleanly on a fresh temporary database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default=DEFAULT_DB_ALIAS,
            help="Database alias to validate against.",
        )
        parser.add_argument(
            "--keepdb",
            action="store_true",
            help="Keep the temporary database after validation for debugging.",
        )

    def handle(self, *args, **options):
        database = options["database"]
        keepdb = options["keepdb"]
        connection = connections[database]

        test_db_name = None
        try:
            self.stdout.write("Creating temporary database for migration validation...")
            test_db_name = connection.creation.create_test_db(
                verbosity=options["verbosity"],
                autoclobber=True,
                serialize=False,
                keepdb=keepdb,
            )
            self.stdout.write(f"Temporary database created: {test_db_name}")

            self._validate_migration_graph(connection)

            self.stdout.write("Applying all migrations to the temporary database...")
            call_command(
                "migrate",
                database=database,
                interactive=False,
                verbosity=options["verbosity"],
                run_syncdb=True,
            )
            self.stdout.write(self.style.SUCCESS("Migration validation succeeded: all migrations applied cleanly."))
        except Exception as exc:
            raise CommandError(str(exc))
        finally:
            if test_db_name and not keepdb:
                self.stdout.write("Destroying temporary database...")
                connection.creation.destroy_test_db(test_db_name, verbosity=options["verbosity"], keepdb=False)

    def _validate_migration_graph(self, connection):
        loader = MigrationLoader(connection)

        conflicts = loader.detect_conflicts()
        if conflicts:
            conflict_lines = []
            for app_label, names in conflicts.items():
                conflict_lines.append(f"{app_label}: {', '.join(names)}")
            raise CommandError("Migration conflicts detected:\n" + "\n".join(conflict_lines))

        try:
            loader.check_consistent_history(connection)
        except Exception as exc:
            raise CommandError(f"Failed to validate migration history: {exc}")
