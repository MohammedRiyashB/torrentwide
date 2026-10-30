import unittest
from fastapi import HTTPException

from backend.app.main import app


class HttpRangeStreamingTests(unittest.TestCase):
    def test_range_route_uses_single_digit_escape_pattern(self):
        import inspect
        from backend.app.main import download_torrent_file

        source = inspect.getsource(download_torrent_file)
        self.assertIn('r"bytes=(\\d*)-(\\d*)"', source)

    def test_range_response_contract_is_registered(self):
        route = next(
            route for route in app.routes
            if getattr(route, "path", None) == "/api/torrents/{torrent_id}/files/{file_index}/download"
        )
        self.assertIn("GET", route.methods)


if __name__ == "__main__":
    unittest.main()
