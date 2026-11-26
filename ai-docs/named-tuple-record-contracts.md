Question: which concrete C++ tuple records should become named-field structs?

Status: proposed Gate 1 contracts, not accepted. Source inventory: src/, include/, demangler/ and unittests/; issue ai-issues/064-named-tuple-records.md.

# Gate 1 — named-field record contracts

Replace concrete C++ domain tuples, not language-level tuple types. All proposed structs are method-free aggregates. Preserve widths, ownership, reference semantics, ordering, sentinels and wire encodings.

## Frontend, diagnostics, CHIR, driver and incremental compilation

```text
IfAvailableMacroParts
  Purpose: Own the three nodes extracted by `AST::MacroExpandExpr::Decompose()`.
  Fields:
    - OwnedPtr<AST::FuncArg> namedArgument — invocation node 0, exposed by `GetNamedArg()`.
    - OwnedPtr<AST::LambdaExpr> firstLambda — invocation node 1, exposed by `GetLambda(0)`.
    - OwnedPtr<AST::LambdaExpr> secondLambda — invocation node 2.
  Methods:
    - none

DiagnosticColorSpan
  Purpose: Apply a color to a half-open byte range in `CombinedLine::meta`.
  Fields:
    - size_t beginOffset — inclusive string offset.
    - size_t endOffset — exclusive string offset.
    - DiagColor color — style applied to those bytes.
  Methods:
    - none

DiagnosticHangingSpan
  Purpose: Record the combined-output-line interval connected by a multiline diagnostic hanging marker.
  Fields:
    - size_t beginLineIndex — first combined-output-line index.
    - size_t endLineIndex — exclusive ending line index; `0` means the matching end has not yet been collected.
    - DiagColor color — marker color.
  Methods:
    - none

UnaryExprKindMapping
  Purpose: Map a unary operation to its ordinary and throwing CHIR expression kinds.
  Fields:
    - CHIR::UnaryExprKind operation — unary operation identifier.
    - CHIR::ExprKind expressionKind — ordinary expression kind.
    - CHIR::ExprKind tryExpressionKind — throwing kind, or `ExprKind::INVALID` when unsupported.
  Methods:
    - none

BinaryExprKindMapping
  Purpose: Map a binary operation to its ordinary and throwing CHIR expression kinds.
  Fields:
    - CHIR::BinaryExprKind operation — binary operation identifier.
    - CHIR::ExprKind expressionKind — ordinary expression kind.
    - CHIR::ExprKind tryExpressionKind — throwing kind, or `ExprKind::INVALID` when unsupported.
  Methods:
    - none

OrderedInputArgument
  Purpose: Preserve command-line ordering across input files, libraries, linker options, and transformed linker arguments.
  Fields:
    - std::string value — stored argument payload: filename, bare library name, raw linker option(s), or the transformed argument ready for the linker, according to the containing collection.
    - uint64_t argumentIndex — original command-line argument index; expanded arguments retain the same index.
  Methods:
    - none

SourceParseInput
  Purpose: Carry source text and its registered source-manager identity through single-threaded and queued parsing.
  Fields:
    - std::string sourceText — source code passed to the parser, not a filesystem path.
    - unsigned fileId — identity returned by `SourceManager::AddSource()`.
  Methods:
    - none

SourceParseResult
  Purpose: Return a parsed file together with comments and parser-computed line count.
  Fields:
    - OwnedPtr<AST::File> file — parsed file transferred into the package.
    - TokenVecMap comments — parser comments subsequently registered with `SourceManager::AddComments()`.
    - size_t lineCount — `Parser::GetLineNum()` result accumulated for profiling.
  Methods:
    - none

ImportedPackageCacheResult
  Purpose: Return imported-package cache information and relationships needed for incremental comparison and pollution analysis.
  Fields:
    - IncrementalCompilation::ASTCache astCache — imported declaration caches.
    - IncrementalCompilation::RawMangled2DeclMap declarationsByMangledName — imported mangled-name-to-declaration lookup.
    - IncrementalCompilation::SrcImportedDepMap sourceImportedDependencies — collected source/imported declaration dependency relationships.
    - IncrementalCompilation::TypeMap typeRelations — additional imported type relationships.
  Methods:
    - none

PollutionMaps
  Purpose: Return reverse usage/pollution indexes and supplementary type relationships.
  Fields:
    - IncrementalCompilation::ChangePollutedMap pollution — direct/name/boxed-type usages, CHIR optimization dependencies, and import aliases collected for change propagation.
    - IncrementalCompilation::TypeMap typeRelations — inheritance, extension, and interface-extension relationships.
  Methods:
    - none

AmbiguousTokenSplit
  Purpose: Describe one lexer degradation step splitting an ambiguous combined token into an emitted prefix and retained suffix.
  Fields:
    - TokenKind prefixKind — kind returned immediately.
    - std::string_view prefixText — spelling returned immediately.
    - TokenKind remainderKind — replacement kind retained at the current token index.
    - std::string_view remainderText — retained token spelling.
  Methods:
    - none

AmbiguousTokenCombination
  Purpose: Describe parser recombination of adjacent split tokens into one ambiguous combined token.
  Fields:
    - TokenKind combinedKind — reconstructed token kind.
    - std::vector<TokenKind> componentKinds — ordered adjacent token kinds matched and consumed.
    - std::string spelling — reconstructed token text, also used for position calculation.
  Methods:
    - none
```

## JIT

```text
JitMetadataBuilder::Safepoint
  Purpose: hold the metadata for one safepoint.
  Fields:
    - uint32_t pc — code-relative program counter
    - Roots gcRoots — garbage-collected reference locations
    - Roots stackRoots — stack-interior reference locations
    - uint32_t line — source line number
    - DerivedRoots derivedRoots — derived locations in GC-base order
  Methods:
    - none

JitMetadataBuilder::CallSite
  Purpose: describe a protected call range and its landing pad.
  Fields:
    - uint32_t start — code-relative range start
    - uint32_t length — protected range length
    - size_t landingPad — landing-pad vector index
  Methods:
    - none

LocalFinalizerSite
  Purpose: identify an after-expression or control-flow-edge cleanup site.
  Fields:
    - const CHIR::Expression* afterExpression — expression for an after-expression site or null for an edge
    - const CHIR::Block* predecessor — predecessor for an edge site
    - const CHIR::Block* successor — successor for an edge site
  Methods:
    - none

SafepointRoots
  Purpose: return root classification for a safepoint.
  Fields:
    - JitMetadataBuilder::Roots gcRoots — garbage-collected reference locations
    - JitMetadataBuilder::Roots stackRoots — stack-interior reference locations
    - JitMetadataBuilder::DerivedRoots derivedRoots — derived locations in GC-base order
  Methods:
    - none
```

Files: src/JIT/Runtime/JitMetadataBuilder.{h,cpp}; src/JIT/X86_64/RegisterAllocation/{LocalFinalizerFrontier,SafepointLiveness}.{h,cpp}; downstream function/compiler consumers.

## CodeGen

```text
EnumAuxiliaryInfo
  Purpose: describe enum reference payloads and constructor-union size.
  Fields:
    - bool hasRefTypeAssociatedValue — whether constructor payloads contain references
    - std::optional<std::size_t> constructorUnionSize — known maximum constructor payload size
  Methods:
    - none

FloatIEEE754Info
  Purpose: describe the integer representation used for nonfinite floating-point checks.
  Fields:
    - unsigned bitWidth — source floating-point bit width
    - uint64_t exponentMask — IEEE754 exponent mask
    - llvm::IntegerType* integerType — corresponding LLVM integer type
  Methods:
    - none

OverflowBlocks
  Purpose: identify the control-flow blocks for an overflow check.
  Fields:
    - llvm::BasicBlock* overflow — overflow path
    - llvm::BasicBlock* normal — nonoverflow path
    - llvm::BasicBlock* end — merge block
  Methods:
    - none

ConstantSerialization
  Purpose: return constant eligibility and the serialized aggregate cache key.
  Fields:
    - bool isConstant — whether all aggregate elements are supported constants
    - std::string serialized — serialized cache key or empty on failure
  Methods:
    - none

SubCHIRCacheEntry
  Purpose: associate an imported metadata name with its package partition.
  Fields:
    - std::string name — metadata entity name
    - uint64_t partitionIndex — cached subpackage index
  Methods:
    - none
```

Files: src/CodeGen/Base/CGTypes/CGEnumType.cpp; src/CodeGen/Base/TypeCastImpl.cpp; src/CodeGen/CJNative/{CHIRSplitter,CJNativeGenOverflow}.cpp; src/CodeGen/Utils/CGUtils.{h,cpp}; aggregate-expression callers.

Retain Vec2Tuple and its implementation: generic arity-based unpacking, not a domain record. Retain transient std::tie comparison expressions. Preserve CallSite lexicographic order by explicit comparator on start, length, landingPad; no public operator needed. Preserve metadata wire encoding, moves, ownership and finalizer-site null conventions.

## Semantic checking, mangling, demangling and Unicode

```text
MacroBufferReadNames
  Purpose: Names used to copy macro input bytes into an array.
  Fields:
    - std::string destinationBufferName — indexed destination (`bufAttr` / `bufParam`).
    - std::string sourcePointerName — pointer receiving `.read(i)` (`attrPtr` / `paramPtr`).
    - std::string sizeName — exclusive loop bound (`attrSize` / `paramSize`).
  Methods:
    - none

MacroTokenAssignmentNames
  Purpose: Names used by conditional `Tokens(buffer)` assignment.
  Fields:
    - std::string destinationTokensName — `attr` / `params`.
    - std::string sourceBufferName — `bufAttr` / `bufParam`.
    - std::string sizeName — size tested against zero.
  Methods:
    - none

MacroWrapperParameters
  Purpose: Own the five generated wrapper parameter declarations.
  Fields:
    - OwnedPtr<AST::FuncParam> attributePointer — CPointer<UInt8> input.
    - OwnedPtr<AST::FuncParam> attributeSize — Int64 input length.
    - OwnedPtr<AST::FuncParam> parameterPointer — CPointer<UInt8> input.
    - OwnedPtr<AST::FuncParam> parameterSize — Int64 input length.
    - OwnedPtr<AST::FuncParam> callbackPointer — CPointer<Unit> macro callback.
  Methods:
    - none

InstantiationTriggerInfo
  Purpose: Save diagnostic context during generic instantiation.
  Fields:
    - Ptr<const AST::Node> triggerNode — diagnostic source node.
    - Ptr<const AST::Decl> triggerDeclaration — instantiated declaration.
    - const std::vector<AST::DataTy> instantiatedTypes — type arguments used in diagnostic names.
  Methods:
    - none

JavaPatternVariableCast
  Purpose: Restore a Java pattern variable’s original type after matching through JObject.
  Fields:
    - Ptr<AST::VarDecl> variable — lowered JObject-bound declaration.
    - AST::ModalTy targetType — original pattern type.
  Methods:
    - none

ObjCPatternVariableCast
  Purpose: Restore an Objective-C pattern variable’s original type after matching through ObjCId.
  Fields:
    - Ptr<AST::VarDecl> variable — lowered binding.
    - Ptr<AST::Ty> targetType — original pattern type used for retained wrapper creation.
  Methods:
    - none

DefaultAccessorLookup
  Purpose: Return a generated default-accessor interface and its selected function.
  Fields:
    - Ptr<AST::InterfaceDecl> interfaceDeclaration — generated accessor interface.
    - Ptr<AST::FuncDecl> functionDeclaration — selected accessor function.
  Methods:
    - none

VariableAccessorKinds
  Purpose: Select getter/setter accessor classifications for instance, static, or global variables.
  Fields:
    - AccessorKind getter — getter classification
    - AccessorKind setter — setter classification
  Methods:
    - none

FunctionReferenceCandidate
  Purpose: Couple a function declaration with one valid instantiation and substitution.
  Fields:
    - Ptr<AST::FuncDecl> declaration — candidate function declaration
    - AST::ModalTy instantiatedType — instantiated function type
    - TypeSubst substitution — type-variable substitution
  Methods:
    - none

VArrayReferenceTypeCheckResult
  Purpose: Report whether VArray element traversal found a forbidden reference-containing type.
  Fields:
    - bool containsReferenceType — whether a forbidden reference-containing type was found
    - std::string offendingTypeName — diagnostic rendering; empty for successful traversal.
  Methods:
    - none

ConstraintBoundsVersions
  Purpose: Preserve four independent backtracking versions for one type variable’s bounds.
  Fields:
    - VersionID lowerBoundsVersion — `TyVarBounds::lbs`.
    - VersionID upperBoundsVersion — `TyVarBounds::ubs`.
    - VersionID alternativeBoundsVersion — `TyVarBounds::sum`, narrowing set of permitted alternatives.
    - VersionID equalityBoundsVersion — `TyVarBounds::eq`, tentative solution set.
  Methods:
    - none

TypeRecursionContext
  Purpose: Supply the parsed types and shared compression state to `RecursionTypes`.
  Fields:
    - size_t nextIndex — next input cursor
    - std::vector<std::unique_ptr<CJType>>& types — parsed type nodes
    - std::unordered_map<std::string, size_t>& treeIds — shared compression dictionary
    - size_t& nextTreeId — shared next dictionary identifier
  Methods:
    - none

EntityPathParseResult
  Purpose: Return entity-path parsing state, including early termination on compressed input.
  Fields:
    - size_t nextIndex — next input cursor
    - EntityType entityType — recognized entity kind
    - std::string entityName — encoded entity name, populated for relevant composite entities.
    - bool stopParsing — caller must immediately return collected entities.
  Methods:
    - none

LambdaPathParseResult
  Purpose: Return lambda entity recognition and cursor advancement.
  Fields:
    - size_t nextIndex — next input cursor
    - EntityType entityType — recognized entity kind
  Methods:
    - none

FunctionSubtreeCompressionResult
  Purpose: Return compression text and cursor from generic/parameter subtree traversal.
  Fields:
    - bool encounteredCompressedInput — true on early return after `ForwardTypes` signals compression.
    - size_t nextIndex — next input cursor
    - std::string compressedName — compressed output text
  Methods:
    - none

FunctionEntityCompressionOptions
  Purpose: Select generic-function traversal and propagate replacement state.
  Fields:
    - bool isGeneric — whether the entity is generic
    - bool isReplaced — existing replacement state
  Methods:
    - none

MangledSubstring
  Purpose: Identify a recorded compression dictionary substring.
  Fields:
    - size_t start — substring start index
    - size_t length — substring length
  Methods:
    - none

ParsedMangledRange
  Purpose: Pass the parsed half-open range used to finalize a dictionary entry.
  Fields:
    - size_t start — substring start index
    - size_t end — exclusive end index
  Methods:
    - none

CompressedNameExpansionResult
  Purpose: Report expansion work and resulting cursor.
  Fields:
    - size_t replacementCount — number of compressed references expanded, not byte-size delta.
    - size_t nextIndex — next input cursor
  Methods:
    - none

GenericPrefixParseContext
  Purpose: Continue parsing generic arguments for an already recorded entity.
  Fields:
    - size_t startIndex — initial parse cursor
    - size_t entityId — dictionary entry index.
    - size_t nextIndex — position of generic prefix before advancing over its marker.
  Methods:
    - none

NamePrefixParseContext
  Purpose: Continue parsing an entity name while retaining prior expansion information.
  Fields:
    - size_t startIndex — initial parse cursor
    - size_t entityId — dictionary entry index.
    - size_t replacementCount — existing parsing state
  Methods:
    - none

AstralCompositionEntry
  Purpose: Map an ordered pair of Unicode code points to their canonical composition.
  Fields:
    - UTF32 firstCodePoint — first input code point
    - UTF32 secondCodePoint — second input code point
    - UTF32 composedCodePoint — canonical composed code point
  Methods:
    - none
```

## Scope decisions and risks

- Remove unused private `ASTDiffImpl::CollectSourcePackage` and the declaration-only `Translator::DelayExitIsNot0` after confirming references; do not invent new records for dead APIs.
- Keep generic tuple machinery, transient iterator grouping, constructor argument packs and memberwise `std::tie` comparisons.
- Separate records even when their old tuple types match but their units or field meanings differ (diagnostic offsets versus line indices; substring length versus end index; distinct mangling contexts).
- Unicode normalization table is generated; its named-record conversion requires an explicit snapshot update because the named generator is absent from this checkout. No numeric table data should change.
- This is Gate 1 only. Code shape and verification plan will follow acceptance; no compiler code has changed.
