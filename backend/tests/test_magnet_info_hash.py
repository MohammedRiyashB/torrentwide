import base64
import unittest

from backend.app.main import magnet_info_hash


class MagnetInfoHashTests(unittest.TestCase):
    def test_accepts_hex_info_hash(self):
        expected = "0123456789abcdef0123456789abcdef01234567"
        self.assertEqual(
            magnet_info_hash(f"magnet:?xt=urn:btih:{expected}"),
            expected,
        )

    def test_accepts_base32_info_hash(self):
        expected = bytes.fromhex("0123456789abcdef0123456789abcdef01234567")
        encoded = base64.b32encode(expected).decode("ascii").rstrip("=")
        self.assertEqual(
            magnet_info_hash(f"magnet:?xt=urn:btih:{encoded}"),
            expected.hex(),
        )

    def test_rejects_magnet_without_info_hash(self):
        with self.assertRaises(Exception):
            magnet_info_hash("magnet:?dn=missing-hash")


if __name__ == "__main__":
    unittest.main()
