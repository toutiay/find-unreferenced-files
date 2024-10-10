import path from 'path';
import fs from 'fs';
import { checkWindowUsage, handleJavaScriptAST, handleTypeScriptJavaScriptAST } from './ast';
import { normalizePath, normalizePathAndOblique, parseArgs, toggleFileComment, writeUnusedFilesToJson } from './tools';
import { decodeUuid, encodeUuid } from './uuid';

// 文件信息接口
export interface FileInfo {
    imported: boolean;
    content: string;
    /**被代码引入的路径 */
    beImportList: Set<string>;
    /**被预制件引入的路径 */
    beImportPrefabList: Set<string>;
    /**引入代码的路径 */
    importList: Set<string>;
    /**压缩uuid */
    compressUUid?: string;
}

// 存储脚本文件和预制件文件的Map
const scriptFileMap = new Map<string, FileInfo>();
const prefabFileMap = new Map<string, FileInfo>();

/**
 * 遍历目录或文件，收集所有ts、js、prefab和scene文件
 * @param dir 要遍历的目录或文件路径
 */
function traverseDirectoryOrFile(dir: string, js: boolean): void {
    const stats = fs.statSync(dir);

    if (stats.isDirectory()) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            traverseDirectoryOrFile(path.join(dir, file), js);
        }
    } else if (stats.isFile()) {
        processFile(dir, js);
    }
}

/**
 * 处理单个文件，将其添加到相应的Map中
 * @param filePath 文件路径
 */
function processFile(filePath: string, js: boolean): void {
    let ext = js ? '.js' : '.ts';
    if ((filePath.endsWith(ext)) && !filePath.endsWith('.d.ts')) {
        addScriptFile(filePath);
    } else if (filePath.endsWith('.prefab') || filePath.endsWith('.scene')) {
        addPrefabFile(filePath);
    }
}

/**
 * 添加脚本文件到scriptFileMap
 * @param filePath 脚本文件路径
 */
function addScriptFile(filePath: string): void {
    const metaPath = `${filePath}.meta`;
    const uuid = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))?.uuid ?? "" : "";
    scriptFileMap.set(normalizePath(filePath), {
        imported: false,
        content: fs.readFileSync(filePath, 'utf-8'),
        beImportList: new Set(),
        importList: new Set(),
        beImportPrefabList: new Set(),
        compressUUid: encodeUuid(uuid)
    });
}

/**
 * 添加预制件文件到prefabFileMap
 * @param filePath 预制件文件路径
 */
function addPrefabFile(filePath: string): void {
    prefabFileMap.set(normalizePath(filePath), {
        imported: false,
        content: fs.readFileSync(filePath, 'utf-8'),
        beImportList: new Set(),
        importList: new Set(),
        beImportPrefabList: new Set()
    });
}

/**
 * 解析脚本文件并检查引用关系
 */
function parseAndCheckReferences(): void {
    console.log("开始解析脚本文件并检查引用关系");
    for (const [filePath, fileInfo] of scriptFileMap) {
        try {
            handleTypeScriptJavaScriptAST(filePath, fileInfo, scriptFileMap);
            // if (filePath.endsWith('.ts')) {
            //     handleTypeScriptAST(filePath, fileInfo, scriptFileMap);
            // } else {
            //     handleJavaScriptAST(filePath, fileInfo, scriptFileMap);
            // }
        } catch (error) {
            console.error(`解析文件 ${filePath} 时出错:`, error);
        }
    }
    console.log("脚本文件解析和引用检查完成");
}

/**
 * 在预制件中查找脚本的压缩UUID
 * @param filePaths 要检查的文件路径数组，如果为空则检查所有脚本文件
 */
function parseAndCheckReferencesForPrefab(filePaths: string[]): void {
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
function findCompressUUidInPrefab(scriptPath: string): void {
    console.log(`>>> 正在查找预制件: ${scriptPath}`);
    const scriptInfo = scriptFileMap.get(scriptPath);
    if (scriptInfo?.compressUUid) {
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
export async function findUnusedFiles(dirPath: string, checkPath: string[], filePaths: string[], js = false) {
    normalizePathAndOblique(checkPath);
    normalizePathAndOblique(filePaths);
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
    let unusedFiles: string[] = [];
    filePaths.forEach((filePath) => {
        logFileInfo(filePath);
        let fileInfo = scriptFileMap.get(filePath);
        if (!fileInfo) {
            return;
        }
        if (fileInfo?.beImportList.size === 0 && fileInfo?.beImportPrefabList.size === 0) {
            unusedFiles.push(filePath);
        }

        console.log(checkWindowUsage(filePath, scriptFileMap.get(filePath)!));
    });
    console.log(`未使用的文件总数: ${unusedFiles.length}`);
    console.log(`   ${unusedFiles.join("\n   ")}`);
    writeUnusedFilesToJson(path.join(__dirname, 'unusedFiles.json'), unusedFiles);
}

export async function sleep(ms: number) {
    await new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

/**
 * 输出文件的详细信息
 * @param filePath 文件路径
 */
function logFileInfo(filePath: string): void {
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
let directoryPath: string = 'D:/project/Prod7/Knight/client/Knight/assets';
//  这些目录的代码文件会被检查
let checkPath: string[] = [
    `${directoryPath}/NoUi3`,
    `${directoryPath}/sub`,
];
//  测试定向检测的文件
let filePaths: string[] = [
    // `${directoryPath}/sub/equipment_frame/EquipmentFrameMain.ts`,
    // `${directoryPath}/sub/equipment_frame/EquipmentFrameGiftbagData.ts`,
    // `${directoryPath}/sub/equipment_frame/EquipmentFrameGiftbag.ts`,
    // `${directoryPath}/mainScene/main.ts`,
    // `${directoryPath}/sub/wx/PlayerInfoWX.ts`,
    // `${directoryPath}/NoUi3/a_star/AStar.ts`,
];

const options = parseArgs();
if (options.findUnusedFiles) {
    console.log(`开始检查: ${JSON.stringify(options)}`);
    findUnusedFiles(directoryPath, checkPath, filePaths, !!options.js);
}
if (options.comment) {
    try {
        let unusedFiles: string[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'unusedFiles.json')).toString());
        unusedFiles.forEach((v) => {
            toggleFileComment(v, true);
        });
    } catch (error) {
        console.error(error);
    }
}
if (options.uncomment) {
    try {
        let unusedFiles: string[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'unusedFiles.json')).toString());
        unusedFiles.forEach((v) => {
            toggleFileComment(v, false);
        });
    } catch (error) {
        console.error(error);
    }
}