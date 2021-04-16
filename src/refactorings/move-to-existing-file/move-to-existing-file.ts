import { Editor, ErrorReason, RelativePath } from "../../editor/editor";
import { Selection } from "../../editor/selection";
import * as t from "../../ast";

export { moveToExistingFile, createVisitor };

async function moveToExistingFile(editor: Editor) {
  const { code, selection } = editor;

  const files = await editor.workspaceFiles();
  if (files.length === 0) {
    editor.showError(ErrorReason.DidNotFindOtherFiles);
    return;
  }

  const selectedFile = await editor.askUserChoice(
    files.map((path) => ({
      value: path,
      label: path.fileName,
      description: path.withoutFileName,
      icon: "file-code"
    })),
    "Search files by name and pick one"
  );
  if (!selectedFile) return;

  const relativePath = selectedFile.value;
  const {
    updatedCode,
    hasReferencesThatCantBeImported,
    movedNode,
    declarationsToImport
  } = updateCode(t.parse(code), selection, relativePath);

  if (!updatedCode.hasCodeChanged) {
    editor.showError(ErrorReason.DidNotFindCodeToMove);
    return;
  }

  if (hasReferencesThatCantBeImported) {
    editor.showError(ErrorReason.CantImportReferences);
    return;
  }

  const otherFileCode = await editor.codeOf(relativePath);
  const otherFileUpdatedCode = updateOtherFileCode(
    t.parse(otherFileCode),
    movedNode,
    declarationsToImport
  );

  await editor.writeIn(relativePath, otherFileUpdatedCode.code);
  await editor.write(updatedCode.code);
}

function updateCode(
  ast: t.AST,
  selection: Selection,
  relativePath: RelativePath
): {
  updatedCode: t.Transformed;
  hasReferencesThatCantBeImported: boolean;
  movedNode: t.Node;
  declarationsToImport: t.ImportDeclaration[];
  movableNode: MovableNode;
} {
  let hasReferencesThatCantBeImported = false;
  let movedNode: t.Node = t.emptyStatement();
  let declarationsToImport: t.ImportDeclaration[] = [];
  let movableNode = new MovableEmptyStatement();

  const updatedCode = t.transformAST(
    ast,
    createVisitor(
      selection,
      (path, importIdentifier, programPath, movableNode) => {
        movedNode = movableNode.value;

        hasReferencesThatCantBeImported =
          movableNode.hasReferencesThatCantBeImported;

        declarationsToImport = movableNode.declarationsToImportFrom(
          relativePath
        );

        t.addImportDeclaration(
          programPath,
          importIdentifier,
          relativePath.withoutExtension
        );

        path.remove();
      }
    )
  );

  return {
    updatedCode,
    hasReferencesThatCantBeImported,
    movedNode,
    declarationsToImport,
    movableNode
  };
}

function updateOtherFileCode(
  ast: t.AST,
  movedNode: t.Node,
  declarationsToImport: t.ImportDeclaration[]
): t.Transformed {
  return t.transformAST(ast, {
    Program(path) {
      declarationsToImport.forEach((declaration) => {
        declaration.specifiers.forEach((specifier) => {
          t.addImportDeclaration(
            path,
            specifier.local,
            declaration.source.value
          );
        });
      });

      const exportedStatement = t.toStatement(
        t.exportNamedDeclaration(movedNode)
      );
      path.node.body.push(exportedStatement);
    }
  });
}

function createVisitor(
  selection: Selection,
  onMatch: (
    path: t.NodePath<t.FunctionDeclaration>,
    importIdentifier: t.Identifier,
    program: t.NodePath<t.Program>,
    movableNode: MovableNode
  ) => void
): t.Visitor {
  return {
    FunctionDeclaration(path) {
      if (!path.parentPath.isProgram()) return;
      if (!path.node.id) return;
      if (!selection.isInsidePath(path)) return;

      const body = path.get("body");
      if (!t.isSelectablePath(body)) return;

      const bodySelection = Selection.fromAST(body.node.loc);
      if (selection.end.isAfter(bodySelection.start)) return;

      onMatch(
        path,
        path.node.id,
        path.parentPath,
        new MovableFunctionDeclaration(path, path.parentPath)
      );
    }
  };
}

interface MovableNode {
  readonly value: t.Node;
  readonly hasReferencesThatCantBeImported: boolean;
  declarationsToImportFrom(relativePath: RelativePath): t.ImportDeclaration[];
}

class MovableEmptyStatement implements MovableNode {
  readonly value = t.emptyStatement();
  readonly hasReferencesThatCantBeImported = false;

  declarationsToImportFrom(_relativePath: RelativePath): t.ImportDeclaration[] {
    return [];
  }
}

class MovableFunctionDeclaration implements MovableNode {
  constructor(
    private path: t.NodePath<t.FunctionDeclaration>,
    private programPath: t.NodePath<t.Program>
  ) {}

  get value(): t.FunctionDeclaration {
    return this.path.node;
  }

  get hasReferencesThatCantBeImported(): boolean {
    return t.hasReferencesDefinedInSameScope(this.path, this.programPath);
  }

  declarationsToImportFrom(relativePath: RelativePath): t.ImportDeclaration[] {
    return t
      .getReferencedImportDeclarations(this.path, this.programPath)
      .map((declaration) => {
        const importRelativePath = new RelativePath(
          declaration.source.value
        ).relativeTo(relativePath);

        return {
          ...declaration,
          source: {
            ...declaration.source,
            value: importRelativePath.value
          }
        };
      });
  }
}
