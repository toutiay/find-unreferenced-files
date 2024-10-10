"use strict";
// //  保留前几位
// let retainCount = 5;
// // encodeUuid
// let BASE16_maxCharCode = 'f'.charCodeAt(0);
// let BASE16_KEYS = '0123456789abcdef=';
// let BASE16_VALUES = new Array(BASE16_maxCharCode + 1);
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUuid = exports.decodeUuid = exports.encodeUuid = void 0;
// for (let i = 0; i <= BASE16_maxCharCode; ++i) {
//     BASE16_VALUES[i] = 16;
// }
// for (let i = 0; i < 16; ++i) {
//     BASE16_VALUES[BASE16_KEYS.charCodeAt(i)] = i;
// }
// let BASE16_HexChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');
// let BASE16_t = ['', '', '', ''];
// let BASE16_UuidTemplate = BASE16_t.concat(BASE16_t, BASE16_t, BASE16_t, BASE16_t, '', '', '');
// let BASE16_Indices = BASE16_UuidTemplate.map(function (x, i) {
//     return i;
// });
// // Encode a regular UUID to a base64 UUID
// export function encodeUuid(fullUuid: string): string {
//     let strs = fullUuid.split('@');
//     let uuid = strs[0];
//     if (uuid.length !== 36) {
//         return uuid;
//     }
//     uuid = uuid.replace(/-/g, '');
//     for (let i = 0; i < retainCount; i++) {
//         BASE16_UuidTemplate[i] = uuid[i];
//     }
//     for (let i = retainCount, j = retainCount; i < 32; i += 3) {
//         let lhs = BASE16_VALUES[uuid.charCodeAt(i)];
//         let mhs = BASE16_VALUES[uuid.charCodeAt(i + 1)];
//         let rhs = BASE16_VALUES[uuid.charCodeAt(i + 2)];
//         BASE16_UuidTemplate[BASE16_Indices[j++]] = BASE16_HexChars[lhs << 2 | mhs >> 2];
//         BASE16_UuidTemplate[BASE16_Indices[j++]] = BASE16_HexChars[rhs | ((mhs & 3) << 4)];
//     }
//     return BASE16_UuidTemplate.join('');
// }
// // decodeUuid
// var BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
// var BASE64_VALUES = new Array(123); // max char code in base64Keys
// for (var i = 0; i < 123; ++i) {
//     BASE64_VALUES[i] = 64;
// } // fill with placeholder('=') index
// for (var i = 0; i < 64; ++i) {
//     BASE64_VALUES[BASE64_KEYS.charCodeAt(i)] = i;
// }
// var BASE64_HexChars = '0123456789abcdef'.split('');
// var BASE64_t = ['', '', '', ''];
// var BASE64_UuidTemplate = BASE64_t.concat(BASE64_t, '-', BASE64_t, '-', BASE64_t, '-', BASE64_t, '-', BASE64_t, BASE64_t, BASE64_t);
// var BASE64_Indices = BASE64_UuidTemplate.map(function (x, i) {
//     return x === '-' ? NaN : i;
// }).filter(isFinite); // fcmR3XADNLgJ1ByKhqcC5Z -> fc991dd7-0033-4b80-9d41-c8a86a702e59
// // Decode a base64 UUID to a regular UUID
// export function decodeUuid(fullUuid: string): string {
//     let strs = fullUuid.split('@');
//     let uuid = strs[0];
//     if (uuid.length !== 23) {
//         return uuid;
//     }
//     for (let i = 0; i < retainCount; i++) {
//         BASE64_UuidTemplate[i] = uuid[i];
//     }
//     for (var i = retainCount, j = retainCount; i < 23; i += 2) {
//         var lhs = BASE64_VALUES[uuid.charCodeAt(i)];
//         var rhs = BASE64_VALUES[uuid.charCodeAt(i + 1)];
//         BASE64_UuidTemplate[BASE64_Indices[j++]] = BASE64_HexChars[lhs >> 2];
//         BASE64_UuidTemplate[BASE64_Indices[j++]] = BASE64_HexChars[(lhs & 3) << 2 | rhs >> 4];
//         BASE64_UuidTemplate[BASE64_Indices[j++]] = BASE64_HexChars[rhs & 0xF];
//     }
//     return BASE64_UuidTemplate.join('');
// }
var Base64KeyChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var AsciiTo64 = new Array(128);
for (var i = 0; i < 128; ++i) {
    AsciiTo64[i] = 0;
}
for (i = 0; i < 64; ++i) {
    AsciiTo64[Base64KeyChars.charCodeAt(i)] = i;
}
var Reg_Dash = /-/g;
var Reg_Uuid = /^[0-9a-fA-F-]{36}$/;
var Reg_NormalizedUuid = /^[0-9a-fA-F]{32}$/;
var Reg_CompressedUuid = /^[0-9a-zA-Z+/]{22,23}$/;
function compressUuid(uuid, min) {
    if (Reg_Uuid.test(uuid)) {
        uuid = uuid.replace(Reg_Dash, '');
    }
    else if (!Reg_NormalizedUuid.test(uuid)) {
        return uuid;
    }
    var reserved = (min === true) ? 2 : 5;
    return compressHex(uuid, reserved);
}
function compressHex(hexString, reservedHeadLength) {
    var length = hexString.length;
    var i;
    if (typeof reservedHeadLength !== 'undefined') {
        i = reservedHeadLength;
    }
    else {
        i = length % 3;
    }
    var head = hexString.slice(0, i);
    var base64Chars = [];
    while (i < length) {
        var hexVal1 = parseInt(hexString[i], 16);
        var hexVal2 = parseInt(hexString[i + 1], 16);
        var hexVal3 = parseInt(hexString[i + 2], 16);
        base64Chars.push(Base64KeyChars[(hexVal1 << 2) | (hexVal2 >> 2)]);
        base64Chars.push(Base64KeyChars[((hexVal2 & 3) << 4) | hexVal3]);
        i += 3;
    }
    return head + base64Chars.join('');
}
function decompressUuid(str) {
    if (str.length === 23) {
        // decode base64
        var hexChars = [];
        for (var i = 5; i < 23; i += 2) {
            var lhs = AsciiTo64[str.charCodeAt(i)];
            var rhs = AsciiTo64[str.charCodeAt(i + 1)];
            hexChars.push((lhs >> 2).toString(16));
            hexChars.push((((lhs & 3) << 2) | rhs >> 4).toString(16));
            hexChars.push((rhs & 0xF).toString(16));
        }
        //
        str = str.slice(0, 5) + hexChars.join('');
    }
    else if (str.length === 22) {
        // decode base64
        var hexChars = [];
        for (var i = 2; i < 22; i += 2) {
            var lhs = AsciiTo64[str.charCodeAt(i)];
            var rhs = AsciiTo64[str.charCodeAt(i + 1)];
            hexChars.push((lhs >> 2).toString(16));
            hexChars.push((((lhs & 3) << 2) | rhs >> 4).toString(16));
            hexChars.push((rhs & 0xF).toString(16));
        }
        //
        str = str.slice(0, 2) + hexChars.join('');
    }
    return [str.slice(0, 8), str.slice(8, 12), str.slice(12, 16), str.slice(16, 20), str.slice(20)].join('-');
}
function encodeUuid(uuid, min) {
    return compressUuid(uuid, min);
}
exports.encodeUuid = encodeUuid;
function decodeUuid(str) {
    return decompressUuid(str);
}
exports.decodeUuid = decodeUuid;
function isUuid(str) {
    return Reg_CompressedUuid.test(str) || Reg_NormalizedUuid.test(str) || Reg_Uuid.test(str);
}
exports.isUuid = isUuid;
