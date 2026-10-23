"""Turn rembg's U²-Netp ONNX export into the capture camera's TFLite garment segmenter.

Usage: python -I convert.py <u2netp.onnx> <work-dir> <size>

1. Fix the input to 1 × 3 × size × size and let onnxruntime fold the shape arithmetic into
   constants (onnx2tf cannot convert U²-Netp's dynamic resize shapes).
2. Convert with onnx2tf. Its calibration-sample download (a pickled numpy file from the internet)
   is replaced by local seeded random data: nothing downloaded is ever unpickled. The data only
   feeds onnx2tf's optional accuracy check; it does not change float weights.

Writes <work-dir>/tflite/<stem>_float16.tflite, which convert.sh copies into the app.
"""

import sys
from pathlib import Path

import numpy as np
import onnx
import onnx2tf
import onnx2tf.onnx2tf as onnx2tf_core
import onnxruntime as ort

BATCH, CHANNELS = 1, 3


def fold(source: Path, target: Path, size: int) -> None:
    model = onnx.load(str(source))
    dims = model.graph.input[0].type.tensor_type.shape.dim
    for dim, value in zip(dims, (BATCH, CHANNELS, size, size), strict=True):
        dim.ClearField("dim_param")
        dim.dim_value = value
    del model.graph.value_info[:]
    for output in model.graph.output:
        for dim in output.type.tensor_type.shape.dim[2:]:
            dim.ClearField("dim_value")
            dim.dim_param = "s"
    static = target.with_suffix(".static.onnx")
    onnx.save(model, str(static))
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    options.optimized_model_filepath = str(target)
    ort.InferenceSession(str(static), options, providers=["CPUExecutionProvider"])


def local_samples() -> np.ndarray:
    return np.random.default_rng(0).random((20, 320, 320, 3), dtype=np.float32)


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    source, work, size = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
    work.mkdir(parents=True, exist_ok=True)
    folded = work / f"u2netp_{size}.onnx"
    fold(source, folded, size)
    onnx2tf_core.download_test_image_data = local_samples
    onnx2tf.convert(
        input_onnx_file_path=str(folded),
        output_folder_path=str(work / "tflite"),
        non_verbose=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
