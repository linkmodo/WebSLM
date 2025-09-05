"""
Optional helper notes for preparing **GGUF** models for the WASM fallback (wllama).
This script prints suggested llama.cpp commands and does basic file checks.
It does NOT run conversions by itself (llama.cpp binaries required).
"""
import os, sys, textwrap

def main(path: str):
    print("""
=== GGUF Prep (notes) ===
1) Clone llama.cpp and build binaries for your OS.
2) Convert a HF model to GGUF (example for TinyLlama):
   python convert.py --outfile tinyllama.gguf /path/to/hf-model
3) (Optional) Split >2GB files to 512MB chunks for browser parallel loading:
   ./llama-gguf-split --split-max-size 512M ./my_model.gguf ./my_model
   -> produces my_model-00001-of-00003.gguf etc.
4) Host artifacts on a static server or Hugging Face. In app, call:
   await wllama.loadModelFromHF("<org>", "<repo>/<file>-00001-of-000NN.gguf")
""")
    if os.path.exists(path):
        s = os.stat(path)
        print(f"File exists: {path}  size={s.st_size/1024/1024:.2f} MB")
    else:
        print(f"(Info) File not found: {path}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv)>1 else "./model.gguf")
