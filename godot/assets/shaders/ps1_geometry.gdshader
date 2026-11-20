shader_type spatial;
render_mode cull_back, diffuse_lambert, specular_disabled;

// DEA-175: PS1-era geometry. Two independent effects:
//   * vertex snapping — vertices are quantised to a low-resolution NDC grid,
//     reproducing the console's fixed-point transform jitter;
//   * affine texture mapping — UVs are interpolated without the perspective
//     divide, so close-up surfaces swim the way 1995 triangles did.

uniform vec2 snap_resolution = vec2(160.0, 120.0);
uniform float snap_amount : hint_range(0.0, 1.0) = 1.0;
uniform bool affine_uv = false;
uniform sampler2D albedo_texture : source_color, filter_nearest, repeat_enable;
uniform vec4 albedo_color : source_color = vec4(1.0);

void vertex() {
	vec4 clip = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	if (snap_amount > 0.0 && snap_resolution.x > 0.0 && snap_resolution.y > 0.0) {
		vec2 ndc = clip.xy / max(abs(clip.w), 0.000001);
		vec2 snapped = round(ndc * snap_resolution) / snap_resolution;
		clip.xy = mix(clip.xy, snapped * clip.w, snap_amount);
	}
	if (affine_uv) {
		// Collapsing w to 1 makes the rasteriser interpolate UV linearly in
		// screen space instead of perspective-correcting it.
		POSITION = vec4(clip.xyz / max(abs(clip.w), 0.000001), 1.0);
	} else {
		POSITION = clip;
	}
}

void fragment() {
	ALBEDO = texture(albedo_texture, UV).rgb * albedo_color.rgb;
}
