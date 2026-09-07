/**
 * High-performance OpenAPI Schema to TypeScript, Zod, Go, and Python Pydantic Compiler
 */

export function schemaToTypeScript(schema: any, typeName = 'PayloadModel', components?: Record<string, any>): string {
  if (!schema) return `export type ${typeName} = any;`;
  
  if (schema.$ref && components) {
    const refName = schema.$ref.split('/').pop();
    if (components[refName]) return schemaToTypeScript(components[refName], refName, components);
  }

  const props = schema.properties || {};
  const required = new Set(schema.required || []);

  let code = `export interface ${typeName} {\n`;
  for (const [key, val] of Object.entries(props)) {
    const propSchema: any = val;
    const isReq = required.has(key);
    const tsType = getTsPropertyType(propSchema, components);
    const desc = propSchema.description ? `  /** ${propSchema.description} */\n` : '';
    code += `${desc}  ${key}${isReq ? '' : '?'}: ${tsType};\n`;
  }
  code += `}`;
  return code;
}

function getTsPropertyType(schema: any, components?: Record<string, any>): string {
  if (!schema) return 'any';
  if (schema.$ref) return schema.$ref.split('/').pop() || 'any';
  if (schema.enum) return schema.enum.map((e: any) => JSON.stringify(e)).join(' | ');
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `${getTsPropertyType(schema.items, components)}[]`;
  if (schema.type === 'object') {
    if (!schema.properties) return 'Record<string, any>';
    return '{\n' + Object.entries(schema.properties).map(([k, v]: any) => `    ${k}: ${getTsPropertyType(v, components)};`).join('\n') + '\n  }';
  }
  return 'any';
}

export function schemaToZod(schema: any, schemaName = 'PayloadSchema'): string {
  if (!schema) return `import { z } from "zod";\n\nexport const ${schemaName} = z.any();`;
  
  const props = schema.properties || {};
  const required = new Set(schema.required || []);

  let code = `import { z } from "zod";\n\nexport const ${schemaName} = z.object({\n`;
  for (const [key, val] of Object.entries(props)) {
    const propSchema: any = val;
    const isReq = required.has(key);
    let zType = getZodPropertyType(propSchema);
    if (!isReq) zType += '.optional()';
    code += `  ${key}: ${zType},\n`;
  }
  code += `});\n\nexport type ${schemaName.replace(/Schema$/, '')} = z.infer<typeof ${schemaName}>;`;
  return code;
}

function getZodPropertyType(schema: any): string {
  if (!schema) return 'z.any()';
  if (schema.enum) return `z.enum([${schema.enum.map((e: any) => JSON.stringify(e)).join(', ')}])`;
  if (schema.type === 'string') {
    if (schema.format === 'email') return 'z.string().email()';
    if (schema.format === 'uuid') return 'z.string().uuid()';
    return 'z.string()';
  }
  if (schema.type === 'integer') return 'z.number().int()';
  if (schema.type === 'number') return 'z.number()';
  if (schema.type === 'boolean') return 'z.boolean()';
  if (schema.type === 'array') return `z.array(${getZodPropertyType(schema.items)})`;
  if (schema.type === 'object') return 'z.record(z.any())';
  return 'z.any()';
}

export function schemaToGo(schema: any, structName = 'PayloadRequest'): string {
  if (!schema) return `type ${structName} map[string]interface{}`;
  
  const props = schema.properties || {};
  const required = new Set(schema.required || []);

  let code = `type ${structName} struct {\n`;
  for (const [key, val] of Object.entries(props)) {
    const propSchema: any = val;
    const fieldName = toPascalCase(key);
    const goType = getGoPropertyType(propSchema);
    const omitempty = required.has(key) ? '' : ',omitempty';
    code += `\t${fieldName} ${goType} \`json:"${key}${omitempty}"\`\n`;
  }
  code += `}`;
  return code;
}

function getGoPropertyType(schema: any): string {
  if (!schema) return 'interface{}';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer') return 'int64';
  if (schema.type === 'number') return 'float64';
  if (schema.type === 'boolean') return 'bool';
  if (schema.type === 'array') return `[]${getGoPropertyType(schema.items)}`;
  if (schema.type === 'object') return 'map[string]interface{}';
  return 'interface{}';
}

export function schemaToPydantic(schema: any, className = 'PayloadModel'): string {
  if (!schema) return `from pydantic import BaseModel\n\nclass ${className}(BaseModel):\n    pass`;
  
  const props = schema.properties || {};
  const required = new Set(schema.required || []);

  let code = `from typing import Optional, List, Dict, Any\nfrom pydantic import BaseModel, Field\n\nclass ${className}(BaseModel):\n`;
  
  const entries = Object.entries(props);
  if (entries.length === 0) {
    code += `    pass\n`;
    return code;
  }

  for (const [key, val] of entries) {
    const propSchema: any = val;
    const isReq = required.has(key);
    const pyType = getPythonPropertyType(propSchema);
    if (isReq) {
      code += `    ${key}: ${pyType}\n`;
    } else {
      code += `    ${key}: Optional[${pyType}] = None\n`;
    }
  }
  return code;
}

function getPythonPropertyType(schema: any): string {
  if (!schema) return 'Any';
  if (schema.type === 'string') return 'str';
  if (schema.type === 'integer') return 'int';
  if (schema.type === 'number') return 'float';
  if (schema.type === 'boolean') return 'bool';
  if (schema.type === 'array') return `List[${getPythonPropertyType(schema.items)}]`;
  if (schema.type === 'object') return 'Dict[str, Any]';
  return 'Any';
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9_]/g, ' ')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
