"""
Stardew Valley XNB 素材解包工具
纯 Python 标准库实现，包含 LZ4 解压和 PNG 编码
完全不修改游戏文件夹，只读取 .xnb 输出 .png 到指定目录
"""
import struct
import os
import sys
from pathlib import Path


# ── LZ4 Block 解压 (XNA 4.0 / MonoGame 使用标准 LZ4 Block 格式) ──

def lz4_decompress(data: bytes, max_size: int = 256 * 1024 * 1024) -> bytes:
    """Decompress XNA LZ4 block-compressed data. Returns decompressed bytes."""
    out = bytearray()
    pos = 0
    end = len(data)

    while pos < end:
        if pos + 4 > end:
            break
        raw = struct.unpack_from('<I', data, pos)[0]
        pos += 4
        size = raw & 0x7FFFFFFF
        is_uncompressed = (raw & 0x80000000) != 0

        if size == 0:
            break

        if is_uncompressed:
            out.extend(data[pos:pos + size])
            pos += size
        else:
            block_end = pos + size
            while pos < block_end:
                token = data[pos]; pos += 1
                lit_len = token >> 4

                # Literal length
                if lit_len == 15:
                    while True:
                        extra = data[pos]; pos += 1
                        lit_len += extra
                        if extra != 255:
                            break

                # Copy literals
                if pos + lit_len > block_end:
                    lit_len = block_end - pos
                out.extend(data[pos:pos + lit_len])
                pos += lit_len

                if pos >= block_end:
                    break

                # Match offset
                offset = struct.unpack_from('<H', data, pos)[0]
                pos += 2
                match_len = (token & 0x0F) + 4

                if match_len == 19:
                    while True:
                        extra = data[pos]; pos += 1
                        match_len += extra
                        if extra != 255:
                            break

                # Copy from output buffer
                match_start = len(out) - offset
                for i in range(match_len):
                    out.append(out[match_start + i])

    return bytes(out)


# ── C# 字符串读取 ──

def read_cs_string(data: bytes, offset: int) -> tuple:
    """Read C# BinaryWriter 7-bit-encoded-length string."""
    length = 0
    shift = 0
    while True:
        byte = data[offset]; offset += 1
        length |= (byte & 0x7F) << shift
        if not (byte & 0x80):
            break
        shift += 7
    s = data[offset:offset + length].decode('utf-8', errors='replace')
    offset += length
    return s, offset


# ── PNG 编码器 ──

def write_png(filepath: str, width: int, height: int, raw_bgra: bytes):
    """Write RGBA PNG from BGRA pixel data using only stdlib."""
    import zlib

    # Convert BGRA → RGBA
    rgba = bytearray()
    for i in range(0, len(raw_bgra), 4):
        b, g, r, a = raw_bgra[i], raw_bgra[i+1], raw_bgra[i+2], raw_bgra[i+3]
        rgba.extend([r, g, b, a])

    def make_chunk(ctype: bytes, data: bytes) -> bytes:
        c = ctype + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + c + crc

    # IHDR: bit depth=8, color type=6 (RGBA)
    ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    # IDAT: filter byte(0) per row + RGBA pixel data
    raw_data = bytearray()
    row_bytes = width * 4
    for y in range(height):
        raw_data.append(0)
        raw_data.extend(rgba[y * row_bytes:(y + 1) * row_bytes])
    idat = make_chunk(b'IDAT', zlib.compress(bytes(raw_data)))

    iend = make_chunk(b'IEND', b'')

    with open(filepath, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend)


# ── XNB Texture2D 解析 ──

def unpack_xnb_texture(filepath: str, output_dir: str) -> bool:
    """Extract PNG from a Stardew Valley .xnb texture file."""
    with open(filepath, 'rb') as f:
        data = f.read()

    if len(data) < 10:
        print(f"  SKIP: file too small")
        return False

    offset = 0
    magic = data[offset:offset+3].decode('ascii'); offset += 3
    if magic != 'XNB':
        print(f"  SKIP: not XNB")
        return False

    platform = chr(data[offset]); offset += 1
    version = data[offset]; offset += 1
    flags = data[offset]; offset += 1
    compressed = (flags & 0x80) != 0

    if compressed:
        decomp_size = struct.unpack_from('<I', data, offset)[0]; offset += 4
        try:
            decompressed = lz4_decompress(data[offset:], decomp_size)
            data = data[:offset] + decompressed
        except Exception as e:
            print(f"  FAIL: LZ4 decompress error: {e}")
            return False

    # Reader count
    reader_count = struct.unpack_from('<I', data, offset)[0]; offset += 4
    for _ in range(reader_count):
        _, offset = read_cs_string(data, offset)  # reader name
        offset += 4  # reader version

    # Shared resource count (0 or 1 byte, depends on version)
    if version >= 5:
        shared_count = data[offset]; offset += 1
    else:
        shared_count = struct.unpack_from('<I', data, offset)[0]; offset += 4

    # Texture2D data
    surface_format = struct.unpack_from('<I', data, offset)[0]; offset += 4
    width = struct.unpack_from('<I', data, offset)[0]; offset += 4
    height = struct.unpack_from('<I', data, offset)[0]; offset += 4
    mip_count = struct.unpack_from('<I', data, offset)[0]; offset += 4

    # SurfaceFormat 0 = Color (BGRA8888), 28 = Dxt3, etc.
    if surface_format == 0:
        bytes_per_pixel = 4
    elif surface_format == 28 or surface_format == 29:
        # DXT compressed - skip for now
        print(f"  SKIP: DXT compressed texture ({width}x{height})")
        return False
    else:
        print(f"  SKIP: unknown surface format {surface_format} ({width}x{height})")
        return False

    # Skip mipmap sizes
    if mip_count > 1:
        for _ in range(mip_count - 1):
            mip_size = struct.unpack_from('<I', data, offset)[0]; offset += 4
            offset += mip_size

    pixel_data_size = width * height * bytes_per_pixel
    pixels = data[offset:offset + pixel_data_size]

    if len(pixels) < pixel_data_size:
        print(f"  FAIL: insufficient pixel data ({len(pixels)} < {pixel_data_size})")
        return False

    out_name = Path(filepath).stem + '.png'
    out_path = os.path.join(output_dir, out_name)
    write_png(out_path, width, height, pixels)
    print(f"  OK: {out_name} ({width}x{height})")
    return True


# ── 主入口 ──

def main():
    if len(sys.argv) < 3:
        print("用法: python unpack_xnb.py <input_dir_or_file> <output_dir>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    os.makedirs(output_dir, exist_ok=True)

    if os.path.isfile(input_path):
        files = [input_path]
    else:
        files = sorted(
            os.path.join(input_path, f)
            for f in os.listdir(input_path)
            if f.endswith('.xnb')
        )

    # Skip language-localized variants
    lang_codes = {'de-DE', 'es-ES', 'fr-FR', 'hu-HU', 'it-IT',
                  'ja-JP', 'ko-KR', 'pt-BR', 'ru-RU', 'tr-TR', 'zh-CN'}
    files = [f for f in files
             if not any(f.endswith(f'.{lang}.xnb') for lang in lang_codes)]

    print(f"已找到 {len(files)} 个 .xnb 文件\n")

    ok = skip = fail = 0
    for fp in files:
        result = unpack_xnb_texture(fp, output_dir)
        if result is True:
            ok += 1
        elif result is False:
            skip += 1
        else:
            fail += 1

    print(f"\n完成: {ok} 解包成功, {skip} 跳过, {fail} 失败")

if __name__ == '__main__':
    main()
