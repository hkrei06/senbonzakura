# EEVEE (Blender's real-time renderer) for the shots that would take hours in Cycles: the same sets, materials, lights
# and keyed animation, rendered in seconds a frame. The user's call (2026-10-26): what Cycles has already rendered stays,
# everything not yet started renders in EEVEE. A shots module calls setup() in its build(S), after render.py's
# lib.setup_render (which leaves the motion blur shutter, the AgX compositor and the PNG output in place).
import bpy


def setup(samples=64, vol_tile='4', vol_samples=96, vol_start=0.1, vol_end=150.0, mblur_steps=2, gi=True):
    """samples: anti-aliasing / soft shadow / depth of field accumulation per frame. vol_*: the froxel haze (smaller
    tiles = finer shafts). mblur_steps: scene evaluations across the shutter (2: the petals' and the camera's motion
    blur both hold; 1 falls back to the velocity blur only)."""
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    ee = sc.eevee
    ee.taa_render_samples = samples
    ee.use_raytracing = True
    ee.ray_tracing_method = 'SCREEN'
    ro = ee.ray_tracing_options
    ro.resolution_scale = '1'
    ro.use_denoise = True
    ro.trace_max_roughness = 0.5
    ee.use_fast_gi = gi
    if gi:
        ee.fast_gi_method = 'GLOBAL_ILLUMINATION'
        ee.fast_gi_resolution = '2'
    ee.volumetric_tile_size = vol_tile
    ee.volumetric_samples = vol_samples
    ee.volumetric_start, ee.volumetric_end = vol_start, vol_end
    ee.use_volumetric_shadows = True
    ee.volumetric_shadow_samples = 32
    ee.use_shadows = True
    ee.shadow_ray_count = 2
    ee.shadow_step_count = 8
    # dozens of lamps each with a point light's six shadow faces overflow the pool ("Shadow buffer full": 2.5 s frames
    # became 17-40 s in the lamp wave): a bigger pool, half-resolution maps, and a coarser limit per lamp
    ee.shadow_pool_size = '2048'
    ee.shadow_resolution_scale = 0.5
    for L in bpy.data.lights:
        if L.type in ('POINT', 'SPOT'):
            for k, v in (('shadow_resolution_limit', 0.02), ('use_shadow_jitter', False)):
                if hasattr(L, k):
                    setattr(L, k, v)
    ee.light_threshold = 0.005
    ee.clamp_surface_indirect = 10.0
    ee.use_overscan = True
    ee.overscan_size = 3.0
    ee.motion_blur_steps = mblur_steps
    return sc
