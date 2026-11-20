shader_type canvas_item;

// DEA-176: PS1-style colour quantisation with ordered (Bayer 4x4) dithering.
// Quantises the composited frame to 15-bit colour (5 bits per channel, 32
// levels) after adding a screen-space ordered dither offset. Rendered last so
// the CRT overlay is quantised with the game image.

uniform sampler2D screen_texture : hint_screen_texture, filter_nearest;
uniform float levels = 32.0;
uniform float dither_strength = 1.0;
uniform vec2 grid_size = vec2(4.0, 4.0);

const float BAYER4[16] = float[16](
	0.0, 8.0, 2.0, 10.0,
	12.0, 4.0, 14.0, 6.0,
	3.0, 11.0, 1.0, 9.0,
	15.0, 7.0, 13.0, 5.0
);

float bayer4(vec2 pixel) {
	ivec2 cell = ivec2(mod(pixel, grid_size));
	return BAYER4[cell.y * 4 + cell.x] / 16.0;
}

void fragment() {
	vec3 col = texture(screen_texture, SCREEN_UV).rgb;
	// Spread each quantisation step across the 4x4 threshold matrix so flat
	// areas dither instead of banding.
	float threshold = (bayer4(FRAGCOORD.xy) - 0.5) * dither_strength;
	float steps = max(levels - 1.0, 1.0);
	col = clamp(col + threshold / steps, vec3(0.0), vec3(1.0));
	col = floor(col * steps + 0.5) / steps;
	COLOR = vec4(col, 1.0);
}
