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
// Station architecture is world-triplanar (see AGENTS.md); without this the
// brushes lose their mapping entirely when this shader is dropped in.
uniform bool use_triplanar = false;
uniform float triplanar_scale = 0.35;
uniform sampler2D albedo_texture : source_color, filter_nearest, repeat_enable;
uniform vec4 albedo_color : source_color = vec4(1.0);

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
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

vec3 triplanar_sample(vec3 pos, vec3 nrm) {
	vec3 blend = pow(abs(nrm), vec3(4.0));
	blend /= max(blend.x + blend.y + blend.z, 0.0001);
	vec3 p = pos * triplanar_scale;
	vec3 cx = texture(albedo_texture, p.zy).rgb;
	vec3 cy = texture(albedo_texture, p.xz).rgb;
	vec3 cz = texture(albedo_texture, p.xy).rgb;
	return cx * blend.x + cy * blend.y + cz * blend.z;
}

void fragment() {
	vec3 tex = use_triplanar
		? triplanar_sample(world_pos, world_normal)
		: texture(albedo_texture, UV).rgb;
	ALBEDO = tex * albedo_color.rgb;
}
