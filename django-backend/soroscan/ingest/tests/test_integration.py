from dataclasses import dataclass

import pytest
from django.contrib.auth import get_user_model

from soroscan.ingest.models import ContractEvent, Network, TrackedContract
from soroscan.ingest.tasks import BATCH_LEDGER_SIZE, backfill_contract_events, sync_events_from_horizon

User = get_user_model()


@dataclass
class MockEvent:
    contract_id: str
    ledger: int
    event_index: int
    tx_hash: str
    type: str
    value: dict
    xdr: str = ""


@pytest.mark.django_db
def test_backfill_contract_events_1000_ledger_range(mocker):
    network = Network.objects.create(
        name="testnet",
        rpc_url="https://soroban-testnet.stellar.org",
        horizon_url="https://horizon-testnet.stellar.org",
        network_passphrase="Test SDF Network ; September 2015",
        is_active=True,
    )
    user = User.objects.create_user(username="integration-user", password="secret")
    contract = TrackedContract.objects.create(
        contract_id="C" + ("a" * 55),
        name="Backfill Contract",
        owner=user,
        is_active=True,
        network=network,
    )

    def build_events_for_window(start_ledger: int, end_ledger: int) -> list[MockEvent]:
        return [
            MockEvent(
                contract_id=contract.contract_id,
                ledger=ledger,
                event_index=0,
                tx_hash=f"tx-{ledger}",
                type="transfer",
                value={"amount": ledger},
            )
            for ledger in range(start_ledger, end_ledger + 1)
        ]

    client_mock = mocker.Mock()
    client_mock.get_events_range.side_effect = [
        build_events_for_window(1, 200),
        build_events_for_window(201, 400),
        build_events_for_window(401, 600),
        build_events_for_window(601, 800),
        build_events_for_window(801, 1000),
    ]
    mocker.patch("soroscan.ingest.tasks.SorobanClient", return_value=client_mock)

    result = backfill_contract_events(contract.contract_id, 1, 1000)

    assert result["from_ledger"] == 1
    assert result["to_ledger"] == 1000
    assert result["created_events"] == 1000
    assert result["updated_events"] == 0
    assert result["processed_events"] == 1000
    assert ContractEvent.objects.filter(contract=contract).count() == 1000

    contract.refresh_from_db()
    assert contract.last_indexed_ledger == 1000

    # 1000 ledgers with a 200-ledger window must request exactly 5 batches.
    assert client_mock.get_events_range.call_count == 1000 // BATCH_LEDGER_SIZE

    # Re-run for the same range to verify idempotency and resume checkpoint behavior.
    client_mock.get_events_range.reset_mock()
    second_run = backfill_contract_events(contract.contract_id, 1, 1000)

    assert second_run["created_events"] == 0
    assert second_run["updated_events"] == 0
    assert second_run["processed_events"] == 0
    assert ContractEvent.objects.filter(contract=contract).count() == 1000
    assert client_mock.get_events_range.call_count == 0


@dataclass
class MockHorizonEvent:
    contract_id: str
    ledger: int
    tx_hash: str
    type: str
    value: dict
    xdr: str = ""


class MockEventsResponse:
    def __init__(self, events: list[MockHorizonEvent]):
        self.events = events


@pytest.mark.django_db
def test_sync_events_from_horizon_multi_network(mocker):
    network_testnet = Network.objects.create(
        name="testnet",
        rpc_url="https://soroban-testnet.stellar.org",
        horizon_url="https://horizon-testnet.stellar.org",
        network_passphrase="Test SDF Network ; September 2015",
        is_active=True,
    )
    network_mainnet = Network.objects.create(
        name="mainnet",
        rpc_url="https://soroban-mainnet.stellar.org",
        horizon_url="https://horizon.stellar.org",
        network_passphrase="Public Global Stellar Network ; September 2015",
        is_active=True,
    )
    user = User.objects.create_user(username="multi-net-user", password="secret")

    contract_testnet = TrackedContract.objects.create(
        contract_id="C" + ("b" * 55),
        name="Testnet Contract",
        owner=user,
        is_active=True,
        network=network_testnet,
    )
    contract_mainnet = TrackedContract.objects.create(
        contract_id="C" + ("c" * 55),
        name="Mainnet Contract",
        owner=user,
        is_active=True,
        network=network_mainnet,
    )

    def build_events_for_contract(contract, start_ledger: int, end_ledger: int) -> list[MockHorizonEvent]:
        return [
            MockHorizonEvent(
                contract_id=contract.contract_id,
                ledger=ledger,
                tx_hash=f"tx-{contract.contract_id[:4]}-{ledger}",
                type="transfer",
                value={"amount": ledger},
            )
            for ledger in range(start_ledger, end_ledger + 1)
        ]

    server_testnet = mocker.Mock()
    server_testnet.get_events.return_value = MockEventsResponse(
        build_events_for_contract(contract_testnet, 1, 3)
    )

    server_mainnet = mocker.Mock()
    server_mainnet.get_events.return_value = MockEventsResponse(
        build_events_for_contract(contract_mainnet, 10, 12)
    )

    def soroban_server_factory(rpc_url: str):
        if "testnet" in rpc_url:
            return server_testnet
        if "mainnet" in rpc_url:
            return server_mainnet
        raise AssertionError(f"Unexpected RPC URL {rpc_url}")

    mocker.patch("soroscan.ingest.tasks.SorobanServer", side_effect=soroban_server_factory)

    created_count = sync_events_from_horizon()

    assert created_count == 6
    assert ContractEvent.objects.filter(contract=contract_testnet).count() == 3
    assert ContractEvent.objects.filter(contract=contract_mainnet).count() == 3

