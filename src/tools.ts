import path from "path";
import fs from "fs";

/**
 * 规范化文件路径
 * @param filePath 需要规范化的文件路径
 * @returns 规范化后的文件路径
 */
export function normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 规范化文件数组路径
 * @param pathString 
 */
export function normalizePathAndOblique(pathStrings: string[]) {
    for (let i = 0; i < pathStrings.length; i++) {
        let pathString = normalizePath(pathStrings[i]);
        // 检查路径是否存在
        if (!fs.existsSync(pathString)) {
            continue;
        }
        const stats = fs.statSync(pathString);
        // 如果是目录，确保以斜杠结尾
        if (stats.isDirectory() && !pathString.endsWith('/')) {
            pathString = pathString + '/';
        }
        // 如果是文件或已经以斜杠结尾，直接返回
        pathStrings[i] = pathString;
    }
}

/**
 * 解析导入路径为绝对路径
 * @param currentFilePath 当前文件的路径
 * @param importPath 导入语句中的路径
 * @returns 解析后的绝对路径，如果解析失败则返回 null
 */
export function resolveImportPath(currentFilePath: string, importPath: string): string | null {
    if (typeof importPath !== 'string') {
        console.log(`无效的导入路径，在文件: ${currentFilePath}`);
        return null;
    }

    let resolvedPath: string;

    if (importPath.startsWith('.')) {
        // 相对路径
        resolvedPath = path.resolve(path.dirname(currentFilePath), importPath);
    } else {
        // 绝对路径或模块名
        return importPath;
    }

    // 添加文件扩展名并规范化路径
    resolvedPath = normalizePath(resolvedPath) + path.extname(currentFilePath);

    return resolvedPath;
}

export function toggleFileComment(filePath: string, shouldComment = true) {
    // 定义特殊的注释标记
    const commentStartMark = '// COMMENT_START_MARK';
    const commentEndMark = '// COMMENT_END_MARK';

    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf8');

    if (!content) {
        return;
    }

    // 检查是否已经被注释
    const isAlreadyCommented = content.startsWith(commentStartMark) && content.endsWith(commentEndMark);

    if (shouldComment && !isAlreadyCommented) {
        // 添加注释
        const lines = content.split('\n');
        const commentedLines = lines.map(line => line.trim() ? `// ${line}` : line);
        content = `${commentStartMark}\n${commentedLines.join('\n')}\n${commentEndMark}`;
    } else if (!shouldComment && isAlreadyCommented) {
        // 移除注释
        content = content
            .substring(commentStartMark.length + 1, content.length - commentEndMark.length - 1)
            .split('\n')
            .map(line => line.startsWith('// ') ? line.substr(3) : line)
            .join('\n');
    }

    // 写回文件
    fs.writeFileSync(filePath, content, 'utf8');

    console.log(`文件: ${filePath} 注释: ${shouldComment}`);
}

export function writeUnusedFilesToJson(filePath: string, unusedFiles: string[]) {
    // 确保 unusedFiles 是一个数组
    if (!Array.isArray(unusedFiles)) {
        console.log('unusedFiles must be an array');
        return;
    }

    // 创建输出对象
    const output = unusedFiles;

    // 将对象转换为 JSON 字符串
    const jsonContent = JSON.stringify(output, null, 2);

    // 写入文件
    try {
        fs.writeFileSync(filePath, jsonContent, 'utf8');
        console.log(`写入成功: \n   ${filePath}`);
    } catch (err) {
        console.log(`写入失败: \n   ${err}`);
    }
}

// 解析命令行参数
export function parseArgs() {
    const args = process.argv.slice(2); // 移除前两个元素（node 执行路径和脚本文件路径）
    let options: { [x: string]: boolean } = {};

    for (const arg of args) {
        options[arg] = true;
    }
    return options;
}