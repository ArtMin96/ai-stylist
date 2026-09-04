"""Load the human GLB as one static world-space mesh with smoothed normals."""
import numpy as np
import scipy.sparse as sp
import trimesh


def load_human(path):
    """Return (vertices, faces, smoothed_normals) in world space.

    The scene graph transform of the single node is applied before anything
    else (contract: identity is expected, but apply it if present).
    """
    scene = trimesh.load(path)
    if isinstance(scene, trimesh.Trimesh):
        mesh = scene
    else:
        names = scene.graph.nodes_geometry
        if len(names) != 1:
            raise ValueError(f"expected one mesh node in human GLB, got {len(names)}")
        transform, geom = scene.graph[names[0]]
        mesh = scene.geometry[geom].copy()
        mesh.apply_transform(transform)
    V = np.asarray(mesh.vertices, dtype=np.float64)
    F = np.asarray(mesh.faces, dtype=np.int64)
    return V, F, smooth_normals(mesh)


def smooth_normals(mesh, passes=2):
    """Area-weighted vertex normals, averaged over 1-ring neighbours."""
    n = len(mesh.vertices)
    e = mesh.edges_unique
    A = sp.coo_matrix((np.ones(len(e) * 2), (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])),
                      shape=(n, n)).tocsr()
    A = A + sp.eye(n)
    N = np.asarray(mesh.vertex_normals, dtype=np.float64)
    for _ in range(passes):
        N = A @ N
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    return N
