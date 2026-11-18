"""Descriptografa um .prsv do PokéRogue (data ou runHistoryData) para JSON.

O .prsv é CryptoJS.AES com senha (formato OpenSSL "Salted__", KDF MD5).
A senha é pública e igual para todo mundo: x0i2O7WRiANTqPmZ

Uso: python scripts/decrypt_save.py ARQUIVO.prsv [SAIDA.json]
Requer: openssl no PATH.
"""
import subprocess, sys
src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else src.rsplit(".", 1)[0] + ".json"
subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-md", "md5", "-a", "-A",
                "-k", "x0i2O7WRiANTqPmZ", "-in", src, "-out", dst], check=True)
print("ok ->", dst)
