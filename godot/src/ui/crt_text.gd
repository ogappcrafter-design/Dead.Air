# crt_text.gd — CRT phosphor text helper for diegetic HUD.
# DEA-108: Diegetic CRT HUD
# Provides color constants, text corruption, and phosphor styling utilities.
# Source: GDD UI spec (docs/plans/redesign-gdd.md lines 1451-1510)
class_name CRTText
extends RefCounted

## --- Color constants (GDD spec) ---

const PHOSPHOR_GREEN: Color = Color(0.0, 1.0, 0.255)    # #00FF41
const AMBER: Color = Color(1.0, 0.647, 0.0)             # #FFA500
const BLOOD_RED: Color = Color(1.0, 0.2, 0.0)           # #FF3300
const BG_BLACK: Color = Color(0.039, 0.039, 0.039)      # #0A0A0A

## --- Corruption thresholds ---

## Composure at or above this: no corruption.
const CORRUPTION_THRESHOLD: float = 30.0

## Characters used for random char swaps.
const CORRUPTION_CHARS: String = "@#$%&*?!~^<>[]{}"

## Corrupt text based on composure level.
## At composure >= 30: returns text unchanged.
## Below 30: progressively corrupts — random char swaps and reversed words.
## The lower the composure, the more aggressive the corruption.
static func corrupt_text(text: String, composure: float) -> String:
	if composure >= CORRUPTION_THRESHOLD:
		return text
	if text.is_empty():
		return text

	# Intensity: 0 at threshold, 1 at 0 composure.
	var intensity: float = 1.0 - (composure / CORRUPTION_THRESHOLD)
	var words: PackedStringArray = text.split(" ", false)
	var result_words: PackedStringArray = PackedStringArray()

	for i in range(words.size()):
		var word: String = words[i]
		# Each word has a chance of being corrupted.
		if _rng_chance(intensity * 0.4):
			word = _corrupt_word(word, intensity)
		result_words.append(word)

	return " ".join(result_words)


## Check if a random event fires (returns true with given probability).
static func _rng_chance(probability: float) -> bool:
	return randf() < probability


## Corrupt a single word: swap characters or reverse it.
static func _corrupt_word(word: String, intensity: float) -> String:
	if word.is_empty():
		return word

	# 30% chance to reverse the word at high intensity.
	if _rng_chance(intensity * 0.3):
		var chars: PackedStringArray = PackedStringArray()
		for c in word:
			chars.append(c)
		chars.reverse()
		return "".join(chars)

	# Otherwise: swap random characters.
	var chars: PackedStringArray = PackedStringArray()
	for c in word:
		if _rng_chance(intensity * 0.25):
			# Replace with a random corruption char.
			var idx: int = randi() % CORRUPTION_CHARS.length()
			chars.append(CORRUPTION_CHARS[idx])
		else:
			chars.append(c)
	return "".join(chars)


## Apply phosphor green color to a Label.
static func style_phosphor_green(label: Label, font_size: int = 16) -> void:
	label.add_theme_color_override("font_color", PHOSPHOR_GREEN)
	label.add_theme_font_size_override("font_size", font_size)


## Apply amber color to a Label.
static func style_amber(label: Label, font_size: int = 16) -> void:
	label.add_theme_color_override("font_color", AMBER)
	label.add_theme_font_size_override("font_size", font_size)


## Apply blood red color to a Label.
static func style_blood_red(label: Label, font_size: int = 16) -> void:
	label.add_theme_color_override("font_color", BLOOD_RED)
	label.add_theme_font_size_override("font_size", font_size)
