# band_config.gd — Container for all band configs
# DEA-149: React Native → Godot asset migration
# DEA-97: Extended for 8 bands (5 sacred + WEATHER, PIRATE, HISTORICAL)
class_name BandConfig
extends Resource

## All bands, indexed by band id (0-7)
## 0-4: Sacred bands (LIVING, LIMINAL, LOST, CLASSIFIED, ████████)
## 5-7: Extended bands (WEATHER, PIRATE, HISTORICAL)
@export var bands: Array[BandData] = []

## Sacred bands are indices 0-4
const SACRED_BAND_COUNT: int = 5

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

## Get count of sacred bands (0-4)
func get_sacred_band_count() -> int:
	return SACRED_BAND_COUNT

## Get count of all bands
func get_band_count() -> int:
	return bands.size()

## Get the next band id after the given one, wrapping around
func get_next_band_id(band_id: int) -> int:
	if bands.is_empty():
		return 0
	return (band_id + 1) % bands.size()

## Get the previous band id before the given one, wrapping around
func get_prev_band_id(band_id: int) -> int:
	if bands.is_empty():
		return 0
	return (band_id - 1 + bands.size()) % bands.size()

## Find which band contains the given frequency. Returns band id or -1 if none.
func find_band_by_frequency(freq: float) -> int:
	for i in range(bands.size()):
		var band: BandData = bands[i]
		if freq >= band.freq_range_min and freq <= band.freq_range_max:
			return i
	return -1

## Check if a frequency is within any band's range
func is_frequency_in_band(freq: float) -> bool:
	return find_band_by_frequency(freq) != -1

## Get all band names as an array
func get_band_names() -> Array[String]:
	var names: Array[String] = []
	for band in bands:
		names.append(band.name)
	return names
