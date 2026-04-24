import json
from unittest.mock import patch

import pytest

from soroscan.ingest.models import IndexerState
from soroscan.ingest.tasks import reconcile_event_completeness

from .factories import ContractEventFactory, TrackedContractFactory


@pytest.mark.django_db
def test_reconcile_event_completeness_detects_gaps_and_persists_state(user):
    contract = TrackedContractFactory(owner=user)
    ContractEventFactory(contract=contract, ledger=10, event_index=0)
    ContractEventFactory(contract=contract, ledger=12, event_index=0)

    with patch("soroscan.ingest.tasks.backfill_contract_events.delay") as mock_backfill:
        result = reconcile_event_completeness()

    assert result["contracts_checked"] >= 1
    assert mock_backfill.called

    state = IndexerState.objects.get(key=f"completeness:{contract.id}")
    payload = json.loads(state.value)
    assert payload["missing_ledgers"] == 1
    assert payload["completeness_percentage"] < 100.0


@pytest.mark.django_db
def test_reconcile_event_completeness_no_gaps_no_repair(user):
    contract = TrackedContractFactory(owner=user)
    ContractEventFactory(contract=contract, ledger=20, event_index=0)
    ContractEventFactory(contract=contract, ledger=21, event_index=0)

    with patch("soroscan.ingest.tasks.backfill_contract_events.delay") as mock_backfill:
        result = reconcile_event_completeness()

    assert result["contracts_checked"] >= 1
    assert result["repair_jobs"] == 0
    mock_backfill.assert_not_called()
