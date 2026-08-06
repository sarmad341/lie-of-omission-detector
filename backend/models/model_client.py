from abc import ABC, abstractmethod
from typing import Optional


class ModelClient(ABC):
    """Common interface every provider client implements (PDR Section 4.3).

    Pipeline code should never import a provider SDK directly — it calls
    this interface via models/router.py, so swapping providers is a config
    change, not a code change.
    """

    @abstractmethod
    def complete(
        self,
        prompt: str,
        image_path: Optional[str] = None,
        response_format: str = "json",
    ) -> str:
        """Send a prompt (optionally with an image) and return the raw text response."""
        raise NotImplementedError
