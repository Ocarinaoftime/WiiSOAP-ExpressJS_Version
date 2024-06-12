
export function u64_get_byte(value: bigint, shift: number): number {
    return Number((value >> BigInt(shift * 8)) & BigInt(0xFF));
}

export function u64_insert_byte(value: bigint, shift: number, byte: number): bigint {
    const mask: bigint = BigInt(0x00000000000000FF) << BigInt(shift * 8);
    const inst: bigint = BigInt(byte) << BigInt(shift * 8);
    return (value & ~mask) | inst;
}

export const table2: number[] = [0x1, 0x5, 0x0, 0x4, 0x2, 0x3, 0x6, 0x7];
export const table1: number[] = [0x4, 0xB, 0x7, 0x9, 0xF, 0x1, 0xD, 0x3, 0xC, 0x2, 0x6, 0xE, 0x8, 0x0, 0xA, 0x5];
export const table1_inv: number[] = [0xD, 0x5, 0x9, 0x7, 0x0, 0xF, 0xA, 0x2, 0xC, 0x3, 0xE, 0x1, 0x8, 0x6, 0xB, 0x4];

export function checkCRC(mix_id: bigint): bigint {
    for (let ctr = 0; ctr <= 42; ctr++) {
        let value: bigint = mix_id >> BigInt(52 - ctr);
        if ((value & BigInt(1)) !== BigInt(0)) {
            value = BigInt(0x0000000000000635) << BigInt(42 - ctr);
            mix_id ^= value;
        }
    }
    return mix_id;
}

export function NWC24iMakeUserID(hollywood_id: number, id_ctr: number, hardware_model: number, area_code: number): bigint {
    let mix_id: bigint = (BigInt(area_code) << BigInt(50)) | (BigInt(hardware_model) << BigInt(47)) | (BigInt(hollywood_id) << BigInt(15)) | (BigInt(id_ctr) << BigInt(10));
    const mix_id_copy1: bigint = mix_id;

    mix_id = checkCRC(mix_id);

    mix_id = (mix_id_copy1 | (mix_id & BigInt(0xFFFFFFFF))) ^ BigInt(0x0000B3B3B3B3B3B3);
    mix_id = (mix_id >> BigInt(10)) | ((mix_id & BigInt(0x3FF)) << BigInt(11 + 32));

    for (let ctr = 0; ctr <= 5; ctr++) {
        const ret: number = u64_get_byte(mix_id, ctr);
        const foobar: number = ((table1[(ret >> 4) & 0xF]) << 4) | (table1[ret & 0xF]);
        mix_id = u64_insert_byte(mix_id, ctr, foobar & 0xff);
    }
    const mix_id_copy2: bigint = mix_id;

    for (let ctr = 0; ctr <= 5; ctr++) {
        const ret: number = u64_get_byte(mix_id_copy2, ctr);
        mix_id = u64_insert_byte(mix_id, table2[ctr], ret);
    }

    mix_id &= BigInt(0x001FFFFFFFFFFFFF);
    mix_id = (mix_id << BigInt(1)) | ((mix_id >> BigInt(52)) & BigInt(1));

    mix_id ^= BigInt(0x00005E5E5E5E5E5E);
    mix_id &= BigInt(0x001FFFFFFFFFFFFF);

    return mix_id;
}

export function getUnscrambleID(nwc24_id: bigint): bigint {
    let mix_id: bigint = nwc24_id;

    mix_id &= BigInt(0x001FFFFFFFFFFFFF);
    mix_id ^= BigInt(0x00005E5E5E5E5E5E);
    mix_id &= BigInt(0x001FFFFFFFFFFFFF);

    let mix_id_copy2: bigint = mix_id;

    mix_id_copy2 ^= BigInt(0xFF);
    mix_id_copy2 = (mix_id << BigInt(5)) & BigInt(0x20);

    mix_id |= mix_id_copy2 << BigInt(48);
    mix_id >>= BigInt(1);

    mix_id_copy2 = mix_id;

    for (let ctr = 0; ctr <= 5; ctr++) {
        const ret: number = u64_get_byte(mix_id_copy2, table2[ctr]);
        mix_id = u64_insert_byte(mix_id, ctr, ret);
    }

    for (let ctr = 0; ctr <= 5; ctr++) {
        const ret: number = u64_get_byte(mix_id, ctr);
        const foobar: number = ((table1_inv[(ret >> 4) & 0xF]) << 4) | (table1_inv[ret & 0xF]);
        mix_id = u64_insert_byte(mix_id, ctr, foobar & 0xff);
    }

    const mix_id_copy3: bigint = mix_id >> BigInt(0x20);
    const mix_id_copy4: bigint = (mix_id >> BigInt(0x16)) | ((mix_id_copy3 & BigInt(0x7FF)) << BigInt(10));
    const mix_id_copy5: bigint = (mix_id * BigInt(0x400)) | ((mix_id_copy3 >> BigInt(0xb)) & BigInt(0x3FF));
    const mix_id_copy6: bigint = (mix_id_copy4 << BigInt(32)) | mix_id_copy5;
    const mix_id_copy7: bigint = mix_id_copy6 ^ BigInt(0x0000B3B3B3B3B3B3);
    mix_id = mix_id_copy7;

    return mix_id;
}

export function decodeWiiID(nwc24_id: bigint, hollywood_id: { value: number }, id_ctr: { value: number }, hardware_model: { value: number }, area_code: { value: number }, crc: { value: number }): bigint {
    const nwc24_id2: bigint = getUnscrambleID(nwc24_id);
    hardware_model.value = Number((nwc24_id2 >> BigInt(47)) & BigInt(7));
    area_code.value = Number((nwc24_id2 >> BigInt(50)) & BigInt(7));
    hollywood_id.value = Number((nwc24_id2 >> BigInt(15)) & BigInt(0xFFFFFFFF));
    id_ctr.value = Number((nwc24_id2 >> BigInt(10)) & BigInt(0x1F));
    crc.value = Number(nwc24_id & BigInt(0x3FF));
    return nwc24_id2;
}

export function NWC24MakeUserID(hollywood_id: number, id_ctr: number, hardware_model: number, area_code: number): bigint {
    const nwc24_id4: bigint = NWC24iMakeUserID(hollywood_id, id_ctr, hardware_model, area_code);
    return nwc24_id4;
}

export let hollywood_id: { value: number } = { value: 0 };
export let id_ctr: { value: number } = { value: 0 };
export let hardware_model: { value: number } = { value: 0 };
export let area_code: { value: number } = { value: 0 };
export let crc: { value: number } = { value: 0 };

export function NWC24CheckUserID(nwc24_id: bigint): number {
    const nwc24_id3: bigint = decodeWiiID(nwc24_id, hollywood_id, id_ctr, hardware_model, area_code, crc);
    return Number(checkCRC(nwc24_id3));
}

export function NWC24GetHollywoodID(nwc24_id: bigint): number {
    decodeWiiID(nwc24_id, hollywood_id, id_ctr, hardware_model, area_code, crc);
    return hollywood_id.value;
}

export function NWC24GetIDCounter(nwc24_id: bigint): number {
    decodeWiiID(nwc24_id, hollywood_id, id_ctr, hardware_model, area_code, crc);
    return id_ctr.value;
}

export function NWC24GetHardwareModel(nwc24_id: bigint): string {
    const models: { [key: number]: string } = {
        0: "RVT",
        1: "RVL",
        2: "RVD",
        7: "UNK",
    };

    decodeWiiID(nwc24_id, hollywood_id, id_ctr, hardware_model, area_code, crc);
    return models[hardware_model.value];
}

export function NWC24GetAreaCode(nwc24_id: bigint): string {
    const regions: { [key: number]: string } = {
        0: "JPN",
        1: "USA",
        2: "EUR",
        3: "TWN",
        4: "KOR",
        5: "HKG",
        6: "CHN",
        7: "UNK",
    };

    decodeWiiID(nwc24_id, hollywood_id, id_ctr, hardware_model, area_code, crc);
    return regions[area_code.value];
}

