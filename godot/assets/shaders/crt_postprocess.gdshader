shader_type canvas_item;
render_mode unshaded, blend_mix;

// ============================================================================
// CRT Post-Processing Shader — DEA-107 / DEA-142
// Deadair's core visual identity: everything looks like an old CRT monitor.
// Degrades in real-time based on dread/composure/signal levels.
// DEA-142: Radial chromatic aberration + signal-driven scanline drift.
// ============================================================================

// --- Uniforms: Runtime-controllable parameters ---

// Signal strength (0-100). Lower = more static noise.
uniform float signal_strength : hint_range(0.0, 100.0) = 80.0;

// Dread level (0-100). Higher = more visual degradation.
uniform float dread_level : hint_range(0.0, 100.0) = 0.0;

// Composure level (0-100). Lower = more glitch/instability.
uniform float composure_level : hint_range(0.0, 100.0) = 100.0;

// --- Scanlines ---
uniform float scanline_spacing : hint_range(1.0, 8.0) = 2.0;
uniform float scanline_opacity : hint_range(0.0, 1.0) = 0.15;
uniform float scanline_roll_speed : hint_range(0.0, 10.0) = 0.0;

// --- Phosphor Glow / Bloom ---
uniform float bloom_intensity : hint_range(0.0, 2.0) = 0.3;
uniform float bloom_radius : hint_range(1.0, 16.0) = 4.0;
uniform vec3 phosphor_color : source_color = vec3(1.0, 0.647, 0.0); // #FFA500 amber

// --- Curvature (barrel distortion) ---
uniform float curvature_amount : hint_range(0.0, 0.15) = 0.02;

// --- Flicker ---
uniform float flicker_intensity : hint_range(0.0, 0.5) = 0.02;
uniform float flicker_speed : hint_range(0.0, 30.0) = 60.0;

// --- Glitch ---
uniform float glitch_intensity : hint_range(0.0, 1.0) = 0.0;
uniform float glitch_shift_max : hint_range(0.0, 16.0) = 8.0;
uniform float color_split_offset : hint_range(0.0, 4.0) = 0.0;
uniform float tear_intensity : hint_range(0.0, 1.0) = 0.0;

// --- Radial Chromatic Aberration (DEA-142) ---
// Distance-from-center based CA: subtle at center, stronger at edges.
// Driven by signal strength — degrades as signal drops.
uniform float ca_radial_amount : hint_range(0.0, 8.0) = 0.0;

// --- Signal-driven scanline drift (DEA-142) ---
// Horizontal sync instability at low signal: scanlines wobble.
uniform float signal_scanline_drift : hint_range(0.0, 4.0) = 0.0;

// --- Vignette ---
uniform float vignette_inner : hint_range(0.0, 1.0) = 0.3;
uniform float vignette_outer : hint_range(0.0, 2.0) = 0.8;
uniform float vignette_intensity : hint_range(0.0, 1.0) = 0.3;

// --- Noise / Static ---
uniform float noise_density : hint_range(0.0, 1.0) = 0.2;

// --- Color Grading ---
uniform float desaturation_amount : hint_range(0.0, 1.0) = 0.0;
uniform vec3 tint_color : source_color = vec3(1.0, 0.647, 0.0); // amber dominant
uniform vec3 alert_color : source_color = vec3(1.0, 0.2, 0.0);  // #FF3300 red
uniform float alert_blend : hint_range(0.0, 1.0) = 0.0;

// --- Color Inversion (composure < 20) ---
uniform float inversion_amount : hint_range(0.0, 1.0) = 0.0;

// --- Time ---
uniform float time_sec = 0.0;

// --- Screen resolution ---
uniform vec2 screen_resolution = vec2(1920.0, 1080.0);

// ============================================================================
// Helper functions
// ============================================================================

// Hash function for pseudo-random noise
float hash(vec2 p) {
	p = fract(p * vec2(123.4567, 789.0123));
	p += dot(p, p + 45.61);
	return fract(p.x * p.y);
}

// 2D hash for glitch row selection
float hash1(float n) {
	return fract(sin(n) * 43758.5453123);
}

// Barrel distortion: maps UV through a lens-like warp
vec2 barrel_distort(vec2 uv, float amount) {
	vec2 cc = uv - 0.5;
	float dist = dot(cc, cc);
	return uv + cc * dist * amount;
}

// Simple box blur for bloom approximation
vec3 sample_blur(sampler2D tex, vec2 uv, float radius) {
	vec2 texel = 1.0 / screen_resolution;
	vec3 sum = vec3(0.0);
	float total = 0.0;
	for (float x = -1.0; x <= 1.0; x += 1.0) {
		for (float y = -1.0; y <= 1.0; y += 1.0) {
			vec2 offset = vec2(x, y) * texel * radius;
			sum += texture(tex, uv + offset).rgb;
			total += 1.0;
		}
	}
	return sum / total;
}

// ============================================================================
// Fragment shader
// ============================================================================

void fragment() {
	// Start with screen-space UV
	vec2 uv = SCREEN_UV;

	// --- Curvature (barrel distortion) ---
	uv = barrel_distort(uv, curvature_amount);

	// Clamp to avoid sampling outside the screen after distortion
	vec2 clamped_uv = clamp(uv, vec2(0.001), vec2(0.999));

	// --- Vertical Roll (dread > 50) ---
	float roll_offset = 0.0;
	if (dread_level > 50.0) {
		float roll_phase = time_sec * scanline_roll_speed * 0.1;
		roll_offset = sin(roll_phase) * 0.005 + hash1(floor(time_sec * 2.0)) * 0.003;
	}
	clamped_uv.y += roll_offset;
	clamped_uv.y = fract(clamped_uv.y);

	// --- Glitch: horizontal pixel shift ---
	float glitch_shift = 0.0;
	if (glitch_intensity > 0.0) {
		float row = floor(clamped_uv.y * screen_resolution.y);
		float row_rand = hash1(row + floor(time_sec * 10.0));

		// Only shift some rows
		if (row_rand < glitch_intensity * 0.3) {
			glitch_shift = (hash1(row * 3.7 + floor(time_sec * 15.0)) - 0.5) * glitch_shift_max / screen_resolution.x;
		}
	}

	// --- Tear (composure < 20: full-frame tear) ---
	float tear_shift = 0.0;
	if (tear_intensity > 0.0) {
		float tear_thresh = 0.5 + sin(time_sec * 3.0) * 0.3;
		if (clamped_uv.y > tear_thresh) {
			tear_shift = (hash1(floor(time_sec * 8.0)) - 0.5) * tear_intensity * 0.02;
		}
	}

	vec2 glitched_uv = clamped_uv + vec2(glitch_shift + tear_shift, 0.0);

	// --- Signal-driven scanline drift (DEA-142) ---
	// Low signal causes horizontal sync instability — scanlines wobble.
	if (signal_scanline_drift > 0.001) {
		float drift = sin(glitched_uv.y * 40.0 + time_sec * 5.0) * signal_scanline_drift / screen_resolution.x;
		glitched_uv.x += drift;
	}

	// --- Chromatic Aberration / Color Channel Split ---
	// Uniform horizontal CA (from glitch/composure)
	float ca_uniform_px = color_split_offset / screen_resolution.x;

	// Radial CA: offset scales with distance from center (DEA-142)
	vec2 ca_center = uv - 0.5;
	float ca_dist = length(ca_center);
	vec2 ca_dir = normalize(ca_center + vec2(0.0001));
	float ca_radial_px = ca_radial_amount / max(screen_resolution.x, 1.0) * ca_dist;
	vec2 ca_radial_offset = ca_dir * ca_radial_px;

	// Combined: R shifts outward, B shifts inward, G stays centered
	vec2 ca_offset_r = vec2(ca_uniform_px, 0.0) + ca_radial_offset;
	vec2 ca_offset_b = vec2(-ca_uniform_px, 0.0) - ca_radial_offset;

	vec3 color;
	if (abs(ca_uniform_px) > 0.001 || ca_radial_px > 0.001) {
		float r = texture(SCREEN_TEXTURE, glitched_uv + ca_offset_r).r;
		float g = texture(SCREEN_TEXTURE, glitched_uv).g;
		float b = texture(SCREEN_TEXTURE, glitched_uv + ca_offset_b).b;
		color = vec3(r, g, b);
	} else {
		color = texture(SCREEN_TEXTURE, glitched_uv).rgb;
	}

	// --- Phosphor Bloom ---
	if (bloom_intensity > 0.01) {
		vec3 bloom = sample_blur(SCREEN_TEXTURE, glitched_uv, bloom_radius);
		// Apply phosphor color tint to bloom
		bloom *= phosphor_color;
		color += bloom * bloom_intensity;
	}

	// --- Scanlines ---
	float scanline_y = floor(glitched_uv.y * screen_resolution.y / scanline_spacing);
	float scanline = sin(glitched_uv.y * screen_resolution.y * 3.14159 / scanline_spacing);
	scanline = pow(max(scanline, 0.0), 1.5);
	color *= mix(1.0, scanline, scanline_opacity);

	// --- RGB Subpixel pattern (phosphor mask) ---
	vec2 subpixel_pos = gl_FragCoord.xy;
	float subpixel_mask = mod(subpixel_pos.x, 3.0);
	vec3 subpixel_color = vec3(1.0);
	if (subpixel_mask < 1.0) {
		subpixel_color = vec3(1.0, 0.0, 0.0); // R
	} else if (subpixel_mask < 2.0) {
		subpixel_color = vec3(0.0, 1.0, 0.0); // G (dominant)
	} else {
		subpixel_color = vec3(0.0, 0.0, 1.0); // B
	}
	// Subtle phosphor mask — green dominant
	color *= mix(vec3(1.0), subpixel_color, 0.05);

	// --- Flicker ---
	float flicker_base = sin(time_sec * flicker_speed) * flicker_intensity;
	float flicker_dread = 0.0;
	if (dread_level > 50.0) {
		// 1-frame darkening bursts
		float burst = step(0.7, hash1(floor(time_sec * 12.0)));
		flicker_dread = -burst * 0.15;
	}
	if (dread_level > 75.0) {
		flicker_dread -= (hash1(floor(time_sec * 20.0)) - 0.5) * 0.2;
	}
	color *= 1.0 + flicker_base + flicker_dread;

	// --- Static Noise ---
	float noise_scale = noise_density;
	if (noise_scale > 0.001) {
		vec2 noise_uv = gl_FragCoord.xy + vec2(time_sec * 100.0, time_sec * 50.0);
		float noise = hash(floor(noise_uv / 2.0));
		// Only apply noise to some pixels (density control)
		float noise_mask = step(1.0 - noise_scale, hash(floor(noise_uv / 3.0)));
		color = mix(color, vec3(noise), noise_mask * noise_scale * 0.8);
	}

	// --- Color Grading: Desaturation ---
	if (desaturation_amount > 0.001) {
		float gray = dot(color, vec3(0.299, 0.587, 0.114));
		color = mix(color, vec3(gray), desaturation_amount);
	}

	// --- Color Grading: Tint (amber dominant) ---
	color *= mix(vec3(1.0), tint_color, 0.15);

	// --- Color Grading: Alert blend (amber → red at dread > 75) ---
	if (alert_blend > 0.001) {
		color = mix(color, color * alert_color, alert_blend);
	}

	// --- Color Inversion (composure < 20) ---
	if (inversion_amount > 0.001) {
		// Intermittent inversion — flickers between normal and inverted
		float inv_mask = step(0.5, hash1(floor(time_sec * 8.0)));
		float inv_active = inversion_amount * inv_mask;
		color = mix(color, vec3(1.0) - color, inv_active);
	}

	// --- Vignette ---
	vec2 vuv = uv - 0.5;
	float vdist = length(vuv) * 2.0;
	float vignette = smoothstep(vignette_outer, vignette_inner, vdist);
	color *= mix(1.0, vignette, vignette_intensity);

	// --- Edge darkening from curvature (simulate CRT bezel) ---
	vec2 edge_dist = abs(uv - 0.5);
	float edge_fade = 1.0 - smoothstep(0.45, 0.5, max(edge_dist.x, edge_dist.y));
	color *= mix(1.0, edge_fade, curvature_amount * 5.0);

	// --- Final clamp ---
	color = clamp(color, vec3(0.0), vec3(1.0));

	COLOR = vec4(color, 1.0);
}
