const K = Uint32Array.from([
  0x42_8a_2f_98, 0x71_37_44_91, 0xb5_c0_fb_cf, 0xe9_b5_db_a5, 0x39_56_c2_5b,
  0x59_f1_11_f1, 0x92_3f_82_a4, 0xab_1c_5e_d5, 0xd8_07_aa_98, 0x12_83_5b_01,
  0x24_31_85_be, 0x55_0c_7d_c3, 0x72_be_5d_74, 0x80_de_b1_fe, 0x9b_dc_06_a7,
  0xc1_9b_f1_74, 0xe4_9b_69_c1, 0xef_be_47_86, 0x0f_c1_9d_c6, 0x24_0c_a1_cc,
  0x2d_e9_2c_6f, 0x4a_74_84_aa, 0x5c_b0_a9_dc, 0x76_f9_88_da, 0x98_3e_51_52,
  0xa8_31_c6_6d, 0xb0_03_27_c8, 0xbf_59_7f_c7, 0xc6_e0_0b_f3, 0xd5_a7_91_47,
  0x06_ca_63_51, 0x14_29_29_67, 0x27_b7_0a_85, 0x2e_1b_21_38, 0x4d_2c_6d_fc,
  0x53_38_0d_13, 0x65_0a_73_54, 0x76_6a_0a_bb, 0x81_c2_c9_2e, 0x92_72_2c_85,
  0xa2_bf_e8_a1, 0xa8_1a_66_4b, 0xc2_4b_8b_70, 0xc7_6c_51_a3, 0xd1_92_e8_19,
  0xd6_99_06_24, 0xf4_0e_35_85, 0x10_6a_a0_70, 0x19_a4_c1_16, 0x1e_37_6c_08,
  0x27_48_77_4c, 0x34_b0_bc_b5, 0x39_1c_0c_b3, 0x4e_d8_aa_4a, 0x5b_9c_ca_4f,
  0x68_2e_6f_f3, 0x74_8f_82_ee, 0x78_a5_63_6f, 0x84_c8_78_14, 0x8c_c7_02_08,
  0x90_be_ff_fa, 0xa4_50_6c_eb, 0xbe_f9_a3_f7, 0xc6_71_78_f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

const pad = (bytes: Uint8Array): DataView => {
  const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(length);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  const bits = bytes.length * 8;
  view.setUint32(length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(length - 4, bits >>> 0);
  return view;
};

const compress = (
  state: Uint32Array,
  view: DataView,
  offset: number,
  w: Uint32Array
): void => {
  for (let i = 0; i < 16; i++) {
    w[i] = view.getUint32(offset + i * 4);
  }
  for (let i = 16; i < 64; i++) {
    const a = w[i - 15] ?? 0;
    const b = w[i - 2] ?? 0;
    const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
    const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
    w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
  }
  const v = Uint32Array.from(state);
  for (let i = 0; i < 64; i++) {
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, hh = 0] = v;
    const t1 =
      hh +
      (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
      ((e & f) ^ (~e & g)) +
      (K[i] ?? 0) +
      (w[i] ?? 0);
    const t2 =
      (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
    v.set([(t1 + t2) >>> 0, a, b, c, (d + t1) >>> 0, e, f, g]);
  }
  for (let i = 0; i < 8; i++) {
    state[i] = ((state[i] ?? 0) + (v[i] ?? 0)) >>> 0;
  }
};

export const sha256Hex = (text: string): string => {
  const view = pad(new TextEncoder().encode(text));
  const state = Uint32Array.from([
    0x6a_09_e6_67, 0xbb_67_ae_85, 0x3c_6e_f3_72, 0xa5_4f_f5_3a, 0x51_0e_52_7f,
    0x9b_05_68_8c, 0x1f_83_d9_ab, 0x5b_e0_cd_19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < view.byteLength; offset += 64) {
    compress(state, view, offset, w);
  }
  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
};
