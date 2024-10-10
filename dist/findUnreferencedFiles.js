"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.findUnusedFiles = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ast_1 = require("./ast");
const tools_1 = require("./tools");
const uuid_1 = require("./uuid");
// 存储脚本文件和预制件文件的Map
const scriptFileMap = new Map();
const prefabFileMap = new Map();
/**
 * 遍历目录或文件，收集所有ts、js、prefab和scene文件
 * @param dir 要遍历的目录或文件路径
 */
function traverseDirectoryOrFile(dir, js) {
    const stats = fs_1.default.statSync(dir);
    if (stats.isDirectory()) {
        const files = fs_1.default.readdirSync(dir);
        for (const file of files) {
            traverseDirectoryOrFile(path_1.default.join(dir, file), js);
        }
    }
    else if (stats.isFile()) {
        processFile(dir, js);
    }
}
/**
 * 处理单个文件，将其添加到相应的Map中
 * @param filePath 文件路径
 */
function processFile(filePath, js) {
    let ext = js ? '.js' : '.ts';
    if ((filePath.endsWith(ext)) && !filePath.endsWith('.d.ts')) {
        addScriptFile(filePath);
    }
    else if (filePath.endsWith('.prefab') || filePath.endsWith('.scene')) {
        addPrefabFile(filePath);
    }
}
/**
 * 添加脚本文件到scriptFileMap
 * @param filePath 脚本文件路径
 */
function addScriptFile(filePath) {
    var _a, _b;
    const metaPath = `${filePath}.meta`;
    const uuid = fs_1.default.existsSync(metaPath) ? (_b = (_a = JSON.parse(fs_1.default.readFileSync(metaPath, 'utf-8'))) === null || _a === void 0 ? void 0 : _a.uuid) !== null && _b !== void 0 ? _b : "" : "";
    scriptFileMap.set((0, tools_1.normalizePath)(filePath), {
        imported: false,
        content: fs_1.default.readFileSync(filePath, 'utf-8'),
        beImportList: new Set(),
        importList: new Set(),
        beImportPrefabList: new Set(),
        compressUUid: (0, uuid_1.encodeUuid)(uuid)
    });
}
/**
 * 添加预制件文件到prefabFileMap
 * @param filePath 预制件文件路径
 */
function addPrefabFile(filePath) {
    prefabFileMap.set((0, tools_1.normalizePath)(filePath), {
        imported: false,
        content: fs_1.default.readFileSync(filePath, 'utf-8'),
        beImportList: new Set(),
        importList: new Set(),
        beImportPrefabList: new Set()
    });
}
/**
 * 解析脚本文件并检查引用关系
 */
function parseAndCheckReferences() {
    console.log("开始解析脚本文件并检查引用关系");
    for (const [filePath, fileInfo] of scriptFileMap) {
        try {
            (0, ast_1.handleTypeScriptJavaScriptAST)(filePath, fileInfo, scriptFileMap);
            // if (filePath.endsWith('.ts')) {
            //     handleTypeScriptAST(filePath, fileInfo, scriptFileMap);
            // } else {
            //     handleJavaScriptAST(filePath, fileInfo, scriptFileMap);
            // }
        }
        catch (error) {
            console.error(`解析文件 ${filePath} 时出错:`, error);
        }
    }
    console.log("脚本文件解析和引用检查完成");
}
/**
 * 在预制件中查找脚本的压缩UUID
 * @param filePaths 要检查的文件路径数组，如果为空则检查所有脚本文件
 */
function parseAndCheckReferencesForPrefab(filePaths) {
    console.log("开始在预制件中查找脚本引用");
    const scriptsToCheck = filePaths;
    for (const scriptPath of scriptsToCheck) {
        findCompressUUidInPrefab(scriptPath);
    }
    console.log("预制件中的脚本引用查找完成");
}
/**
 * 在预制件中查找特定脚本的压缩UUID
 * @param scriptPath 脚本路径
 */
function findCompressUUidInPrefab(scriptPath) {
    console.log(`>>> 正在查找预制件: ${scriptPath}`);
    const scriptInfo = scriptFileMap.get(scriptPath);
    if (scriptInfo === null || scriptInfo === void 0 ? void 0 : scriptInfo.compressUUid) {
        for (const [prefabPath, prefabInfo] of prefabFileMap) {
            if (prefabInfo.content.includes(scriptInfo.compressUUid)) {
                console.log(`    ${prefabPath}`);
                scriptInfo.beImportPrefabList.add(prefabPath);
            }
        }
    }
}
/**
 * 查找未使用的文件
 * @param dirPath 要搜索的目录路径
 * @param checkPath 这些文件夹内的代码才会被检测
 * @param filePaths 要检查的特定文件路径数组
 */
async function findUnusedFiles(dirPath, checkPath, filePaths, js = false) {
    (0, tools_1.normalizePathAndOblique)(checkPath);
    (0, tools_1.normalizePathAndOblique)(filePaths);
    console.log(`根目录: ${dirPath}`);
    console.log(`检查目录: ${checkPath}`);
    console.log(`检查文件: ${filePaths}`);
    console.log(`开始查找未使用的文件`);
    await sleep(1000);
    traverseDirectoryOrFile(dirPath, js);
    parseAndCheckReferences();
    //  要查找的ts文件，暂时只查找没有被代码引用的文件
    if (!filePaths.length) {
        for (const [filePath, fileInfo] of scriptFileMap) {
            let inCheckedList = false;
            for (let i = 0; i < checkPath.length; i++) {
                const element = checkPath[i];
                if (filePath.startsWith(element)) {
                    inCheckedList = true;
                    break;
                }
            }
            if (inCheckedList && fileInfo.beImportList.size === 0) {
                filePaths.push(filePath);
            }
        }
    }
    parseAndCheckReferencesForPrefab(filePaths);
    let unusedFiles = [];
    filePaths.forEach((filePath) => {
        logFileInfo(filePath);
        let fileInfo = scriptFileMap.get(filePath);
        if (!fileInfo) {
            return;
        }
        if ((fileInfo === null || fileInfo === void 0 ? void 0 : fileInfo.beImportList.size) === 0 && (fileInfo === null || fileInfo === void 0 ? void 0 : fileInfo.beImportPrefabList.size) === 0) {
            unusedFiles.push(filePath);
        }
        console.log((0, ast_1.checkWindowUsage)(filePath, scriptFileMap.get(filePath)));
    });
    console.log(`未使用的文件总数: ${unusedFiles.length}`);
    console.log(`   ${unusedFiles.join("\n   ")}`);
    (0, tools_1.writeUnusedFilesToJson)(path_1.default.join(__dirname, 'unusedFiles.json'), unusedFiles);
}
exports.findUnusedFiles = findUnusedFiles;
async function sleep(ms) {
    await new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}
exports.sleep = sleep;
/**
 * 输出文件的详细信息
 * @param filePath 文件路径
 */
function logFileInfo(filePath) {
    console.log("----------------------------------------");
    const fileInfo = scriptFileMap.get(filePath);
    if (!fileInfo) {
        console.log(`文件不存在: ${filePath}`);
        return;
    }
    console.log(`文件: ${filePath}`);
    console.log(`压缩UUID: ${fileInfo.compressUUid}`);
    console.log(`被代码引入次数: ${fileInfo.beImportList.size}`);
    fileInfo.beImportList.size > 0 && console.log(`   ${Array.from(fileInfo.beImportList).join("\n   ")}`);
    console.log(`被预制件引入次数: ${fileInfo.beImportPrefabList.size}`);
    fileInfo.beImportPrefabList.size > 0 && console.log(`   ${Array.from(fileInfo.beImportPrefabList).join("\n   ")}`);
    console.log(`引入其他代码次数: ${fileInfo.importList.size}`);
    fileInfo.importList.size > 0 && console.log(`   ${Array.from(fileInfo.importList).join("\n   ")}`);
}
//  根目录
let directoryPath = 'D:/project/Prod7/Knight/client/Knight/assets';
//  这些目录的代码文件会被检查
let checkPath = [
    `${directoryPath}/NoUi3`,
    `${directoryPath}/sub`,
];
//  测试定向检测的文件
let filePaths = [
// `${directoryPath}/sub/equipment_frame/EquipmentFrameMain.ts`,
// `${directoryPath}/sub/equipment_frame/EquipmentFrameGiftbagData.ts`,
// `${directoryPath}/sub/equipment_frame/EquipmentFrameGiftbag.ts`,
// `${directoryPath}/mainScene/main.ts`,
// `${directoryPath}/sub/wx/PlayerInfoWX.ts`,
// `${directoryPath}/NoUi3/a_star/AStar.ts`,
];
const options = (0, tools_1.parseArgs)();
if (options.findUnusedFiles) {
    console.log(`开始检查: ${JSON.stringify(options)}`);
    findUnusedFiles(directoryPath, checkPath, filePaths, !!options.js);
}
if (options.comment) {
    try {
        let unusedFiles = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, 'unusedFiles.json')).toString());
        unusedFiles.forEach((v) => {
            (0, tools_1.toggleFileComment)(v, true);
        });
    }
    catch (error) {
        console.error(error);
    }
}
if (options.uncomment) {
    try {
        let unusedFiles = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, 'unusedFiles.json')).toString());
        unusedFiles.forEach((v) => {
            (0, tools_1.toggleFileComment)(v, false);
        });
    }
    catch (error) {
        console.error(error);
    }
}
