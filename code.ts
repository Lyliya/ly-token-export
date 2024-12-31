figma.showUI(__html__, { width: 650, height: 500 });

type Value = {
  reference?: string;
  value: null | string | number | boolean;
};

function rgba2hex(r: number, g: number, b: number, a?: number) {
  const hex =
    ((r * 255) | (1 << 8)).toString(16).slice(1) +
    ((g * 255) | (1 << 8)).toString(16).slice(1) +
    ((b * 255) | (1 << 8)).toString(16).slice(1);

  if (a !== undefined && a !== 1) {
    const alpha =
      a !== undefined ? ((a * 255) | (1 << 8)).toString(16).slice(1) : "";

    return `#${hex + alpha}`;
  }
  return `#${hex}`;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "get-collections") {
    const collections = figma.variables
      ? await figma.variables.getLocalVariableCollectionsAsync()
      : [];
    const collectionData = collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
    }));

    figma.ui.postMessage({
      type: "populate-collections",
      collections: collectionData,
    });
  }

  if (msg.type === "export-tokens") {
    const collection = (
      await figma.variables.getLocalVariableCollectionsAsync()
    ).find((c) => c.id === msg.selectedCollectionId);
    const variables = await figma.variables.getLocalVariablesAsync();

    if (!collection) {
      return;
    }

    const parseVariableValue = (value: VariableValue): Value | null => {
      if (
        typeof value === "object" &&
        "type" in value &&
        value.type === "VARIABLE_ALIAS"
      ) {
        const ref = variables.find((v) => v.id === value.id);
        if (!ref) {
          return null;
        }
        return {
          reference: ref.name,
          value: null,
        };
      } else if (typeof value === "object" && "a" in value) {
        return { value: rgba2hex(value.r, value.g, value.b, value.a) };
      } else if (typeof value === "object" && !("a" in value) && "r" in value) {
        return { value: rgba2hex(value.r, value.g, value.b) };
      } else {
        return {
          // @ts-expect-error: Already check for RGB(A) and VariableAlias
          value: value,
        };
      }
    };

    const getVariable = (variable: Variable) => {
      return Object.keys(variable.valuesByMode).map((key) => {
        const modeName = collection?.modes.find(
          (mode) => mode.modeId === key
        )?.name;
        return {
          mode: modeName,
          value: parseVariableValue(variable.valuesByMode[key]),
        };
      });
    };

    const variableCollections = {
      name: collection.name,
      id: collection.id,
      variables: collection.variableIds
        .map((id) => {
          const variable = variables.find((v) => v.id === id);
          if (!variable) return undefined;
          return {
            name: variable.name,
            id: variable?.id,
            value: getVariable(variable),
            resolvedType: variable.resolvedType,
          };
        })
        .filter(Boolean),
    };

    figma.ui.postMessage({
      type: "tokens-exported",
      tokens: variableCollections,
    });
  }

  if (msg.type === "close-plugin") {
    figma.closePlugin();
  }
};
