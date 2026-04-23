from __future__ import annotations

from scripts.work24_partition_sync import REGION_PARTITIONS, ordered_region_partitions


def test_work24_region_partition_order_covers_17_regions_once() -> None:
    codes = [partition.code for partition in REGION_PARTITIONS]

    assert len(codes) == 17
    assert len(set(codes)) == 17
    assert codes[:3] == ["11", "41", "28"]


def test_work24_region_partition_order_skips_seoul_by_default_for_followup_runs() -> None:
    partitions = ordered_region_partitions(include_seoul=False)

    assert [partition.code for partition in partitions[:3]] == ["41", "28", "51"]
    assert "11" not in {partition.code for partition in partitions}


def test_work24_region_partition_order_can_resume_from_code_or_name() -> None:
    by_code = ordered_region_partitions(include_seoul=False, start_from="47")
    by_name = ordered_region_partitions(include_seoul=False, start_from="경북")

    assert [partition.code for partition in by_code[:3]] == ["47", "27", "48"]
    assert by_code == by_name


def test_work24_region_partition_order_can_stop_after_region() -> None:
    partitions = ordered_region_partitions(include_seoul=False, stop_after="대전")

    assert [partition.code for partition in partitions] == ["41", "28", "51", "43", "44", "36", "30"]
