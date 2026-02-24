import os

from django.db import migrations


def seed_default_networks(apps, schema_editor):
    Network = apps.get_model("ingest", "Network")

    if Network.objects.exists():
        return

    # Testnet defaults (Soroban public testnet)
    testnet_rpc = os.environ.get("STELLAR_TESTNET_RPC_URL", "https://soroban-testnet.stellar.org")
    testnet_horizon = os.environ.get(
        "STELLAR_TESTNET_HORIZON_URL",
        "https://horizon-testnet.stellar.org",
    )
    testnet_passphrase = os.environ.get(
        "STELLAR_TESTNET_NETWORK_PASSPHRASE",
        os.environ.get(
            "STELLAR_NETWORK_PASSPHRASE",
            "Test SDF Network ; September 2015",
        ),
    )

    # Mainnet defaults (placeholders; should be overridden via env in production)
    mainnet_rpc = os.environ.get("STELLAR_MAINNET_RPC_URL", "https://soroban-mainnet.stellar.org")
    mainnet_horizon = os.environ.get(
        "STELLAR_MAINNET_HORIZON_URL",
        "https://horizon.stellar.org",
    )
    mainnet_passphrase = os.environ.get("STELLAR_MAINNET_NETWORK_PASSPHRASE", "")

    Network.objects.create(
        name="testnet",
        rpc_url=testnet_rpc,
        horizon_url=testnet_horizon,
        network_passphrase=testnet_passphrase,
        is_active=True,
    )

    Network.objects.create(
        name="mainnet",
        rpc_url=mainnet_rpc,
        horizon_url=mainnet_horizon,
        network_passphrase=mainnet_passphrase,
        is_active=False,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("ingest", "0002_network_and_trackedcontract_network"),
    ]

    operations = [
        migrations.RunPython(seed_default_networks, migrations.RunPython.noop),
    ]

