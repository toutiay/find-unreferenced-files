import ts from "typescript";
import { FileInfo } from "./findUnreferencedFiles";
import { parse } from '@babel/parser';
import { isIdentifier, isImport } from '@babel/types';
import traverse from '@babel/traverse';
import { resolveImportPath } from "./tools";

// 控制是否启用AST日志记录
const ENABLE_AST_LOGGING = true;

/**
 * 如果启用了AST日志，则记录消息
 * @param message 要记录的消息
 */
function astLog(message: string): void {
    if (ENABLE_AST_LOGGING) {
        console.log(message);
    }
}

/**
 * 更新文件映射中的导入信息
 * @param fileMap 所有文件的映射
 * @param importingFile 进行导入的文件
 * @param importedFile 被导入的文件
 */
function updateFileMap(fileMap: Map<string, FileInfo>, importingFile: string, importedFile: string): void {
    if (fileMap.has(importedFile)) {
        fileMap.get(importedFile)!.beImportList.add(importingFile);
    }
    if (fileMap.has(importingFile)) {
        fileMap.get(importingFile)!.importList.add(importedFile);
    }
}

/**
 * 处理JavaScript或TypeScript中的导入
 * @param fileMap 所有文件的映射
 * @param filePath 包含导入的文件的路径
 * @param importPath 被导入文件的路径
 */
function handleImport(fileMap: Map<string, FileInfo>, filePath: string, importPath: string): void {
    const resolvedImportPath = resolveImportPath(filePath, importPath);
    astLog(`    ${resolvedImportPath}`);
    if (resolvedImportPath != null) {
        updateFileMap(fileMap, filePath, resolvedImportPath);
    }
}

/**
 * 解析JavaScript文件并提取导入信息
 * @param filePath 要解析的文件路径
 * @param fileInfo 文件信息
 * @param fileMap 所有文件的映射
 */
export function handleJavaScriptAST(filePath: string, fileInfo: FileInfo, fileMap: Map<string, FileInfo>): void {
    astLog(`>>> 正在解析JavaScript AST: ${filePath}`);

    const ast = parse(fileInfo.content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators', 'classProperties'],
    });

    traverse(ast, {
        ImportDeclaration({ node }: any) {
            handleImport(fileMap, filePath, node.source.value);
        },
        CallExpression({ node }: any) {
            if (isIdentifier(node.callee, { name: 'require' }) || isImport(node.callee)) {
                handleImport(fileMap, filePath, node.arguments[0].value);
            }
        },
    });
}

/**
 * 解析TypeScript文件并提取导入信息
 * @param filePath 要解析的文件路径
 * @param fileInfo 文件信息
 * @param fileMap 所有文件的映射
 */
export function handleTypeScriptJavaScriptAST(filePath: string, fileInfo: FileInfo, fileMap: Map<string, FileInfo>): void {
    astLog(`>>> 正在解析TypeScript/JavaScript AST: ${filePath}`);

    const sourceFile = ts.createSourceFile(
        filePath,
        fileInfo.content,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );

    ts.forEachChild(sourceFile, node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            handleImport(fileMap, filePath, node.moduleSpecifier.text);
        }
    });
}

export interface UsageResult {
    /** 
     * window 对象的属性赋值
     * type: 'static' 表示直接属性访问，'dynamic' 表示使用方括号访问
     * key: 被赋值的属性名
     */
    assignments: Array<{ type: string; key: string }>;

    /** 
     * window 对象的属性引用
     * type: 'static' 表示直接属性访问，'dynamic' 表示使用方括号访问
     * key: 被引用的属性名
     */
    references: Array<{ type: string; key: string }>;

    /** 
     * 从 window 对象中解构的属性名列表
     */
    destructured: string[];

    /** 
     * 通过 window 对象调用的函数名列表
     */
    functionCalls: string[];

    /** 
     * window 对象的别名列表
     */
    aliases: string[];

    /** 
     * window 对象作为参数传递的情况
     * functionName: 接收 window 作为参数的函数名
     * argumentIndex: window 在参数列表中的位置索引
     */
    passedAsArgument: Array<{ functionName: string; argumentIndex: number }>;

    /** 
     * 对 window.prototype 进行扩展的方法名列表
     */
    prototypeExtensions: string[];

    /** 
     * 在条件语句中检查 window 属性的属性名列表
     */
    conditionalChecks: string[];
}

/**
 * 进行window.abc=def或者使用window.abc的检查
 * @param filePath 
 * @param fileInfo 
 * @returns 
 */
export function checkWindowUsage(filePath: string, fileInfo: FileInfo): UsageResult {
    const sourceFile = ts.createSourceFile(
        filePath,
        fileInfo.content,
        ts.ScriptTarget.Latest,
        true
    );

    const result: UsageResult = {
        assignments: [],
        references: [],
        destructured: [],
        functionCalls: [],
        aliases: [],
        passedAsArgument: [],
        prototypeExtensions: [],
        conditionalChecks: []
    };

    function visit(node: ts.Node) {
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if (ts.isPropertyAccessExpression(node.left) && ts.isIdentifier(node.left.expression) && node.left.expression.text === 'window') {
                result.assignments.push({ type: 'static', key: node.left.name.text });
            } else if (ts.isElementAccessExpression(node.left) && ts.isIdentifier(node.left.expression) && node.left.expression.text === 'window') {
                const key = node.left.argumentExpression.getText(sourceFile);
                result.assignments.push({ type: 'dynamic', key });
            }
        } else if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'window') {
            if (!ts.isBinaryExpression(node.parent) || node.parent.left !== node) {
                result.references.push({ type: 'static', key: node.name.text });
            }
        } else if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'window') {
            if (!ts.isBinaryExpression(node.parent) || node.parent.left !== node) {
                const key = node.argumentExpression.getText(sourceFile);
                result.references.push({ type: 'dynamic', key });
            }
        } else if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) &&
            node.initializer && ts.isIdentifier(node.initializer) && node.initializer.text === 'window') {
            node.name.elements.forEach(element => {
                if (ts.isIdentifier(element.name)) {
                    result.destructured.push(element.name.text);
                }
            });
        } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'window') {
            result.functionCalls.push(node.expression.name.text);
        } else if (ts.isCallExpression(node)) {
            node.arguments.forEach((arg, index) => {
                if (ts.isIdentifier(arg) && arg.text === 'window') {
                    const functionName = ts.isIdentifier(node.expression) ? node.expression.text : 'anonymous';
                    result.passedAsArgument.push({ functionName, argumentIndex: index });
                }
            });
        } else if (ts.isVariableDeclaration(node) && node.initializer &&
            ts.isIdentifier(node.initializer) && node.initializer.text === 'window' &&
            ts.isIdentifier(node.name)) {
            result.aliases.push(node.name.text);
        } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(node.left) && ts.isPropertyAccessExpression(node.left.expression) &&
            ts.isIdentifier(node.left.expression.expression) && node.left.expression.expression.text === 'window' &&
            ts.isIdentifier(node.left.expression.name) && node.left.expression.name.text === 'prototype') {
            result.prototypeExtensions.push(node.left.name.text);
        } else if (ts.isIfStatement(node) && ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'window') {
            result.conditionalChecks.push(node.expression.name.text);
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return result;
}