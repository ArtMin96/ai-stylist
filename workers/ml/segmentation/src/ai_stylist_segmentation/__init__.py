"""AI Stylist segmentation worker — a stateless FastAPI service (doc 04 §2, `workers/ml`)."""

from importlib.metadata import PackageNotFoundError, version

SERVICE_NAME = "segmentation"

try:
    __version__ = version("ai-stylist-segmentation")
except PackageNotFoundError:  # running from an un-installed checkout
    __version__ = "0.0.0+unknown"
