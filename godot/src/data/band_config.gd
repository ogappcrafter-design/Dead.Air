# band_config.gd — Container for all band configs
# DEA-149: React Native → Godot asset migration
class_name BandConfig
extends Resource

## All 5 sacred bands, indexed by band id
@export var bands: Array[BandData] = []

## Lookup band by id
func get_band(band_id: int) -> BandData:
	if band_id >= 0 and band_id < bands.size():
		return bands[band_id]
	push_error("BandConfig: No band with id %d" % band_id)
	return null

## Lookup band by name
func get_band_by_name(band_name: String) -> BandData:
	for band in bands:
		if band.name == band_name:
			return band
	push_error("BandConfig: No band named '%s'" % band_name)
	return null

## Get count of sacred bands
func get_sacred_band_count() -> int:
	return bands.size()
