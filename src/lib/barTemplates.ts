// Barrel so consumers import 'ollave/lib/barTemplates' (the package exports
// glob "./lib/*" resolves this file; the implementation lives in the
// barTemplates/ directory). Deliberately NOT re-exported from the lib index:
// index would then import the templates' fetch/propagate machinery on every
// lib consumer, and barTemplates itself imports from the index barrel.
export * from './barTemplates/index'
