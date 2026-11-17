# Graph Report - sgc-dm  (2026-11-17)

## Corpus Check
- 591 files · ~532,400 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 5, .css 4, .example 2)

## Summary
- 3759 nodes · 13803 edges · 163 communities (132 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e15dc6c5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- gestao.tsx
- routeTree.gen.ts
- cn
- MinuteBodyEditor.tsx
- formatDateBR
- event-finance-export.ts
- sonner
- auth-middleware.ts
- SindicanciaAtaForm.tsx
- calendario.tsx
- sindicancias.sindicarias.tsx
- investigations.functions.ts
- eventos.$id.tsx
- AppShell.tsx
- membros.solicitacoes.tsx
- Label
- timezone.ts
- sindicancias.fichas.tsx
- accounts.functions.ts
- membros.index.tsx
- docs-catalog.ts
- finance.functions.ts
- react
- event-finance.functions.ts
- package.json
- Button
- tesouraria.fluxo.tsx
- MemberFields.tsx
- org-join-request.functions.ts
- @tanstack/react-router
- useActiveChapter
- permissions.ts
- ref_node_assert
- tesouraria.mensalidades.tsx
- ThemeToggle
- Card
- position-catalog.functions.ts
- screen-access.ts
- audit-log.ts
- Atrasados
- devDependencies
- instituicoes.$id.tsx
- email-templates.ts
- formatBRL
- dependencies
- auth-nav-cache.ts
- timezone.ts
- atas.tsx
- office-signatures.functions.ts
- resolve-linked-members.ts
- member-documents.ts
- ChapterAuditPanel.tsx
- ActiveChapterContext.tsx
- PresencasAnalytics.tsx
- org-public-path.functions.ts
- finance-pdf.ts
- chapter-logo.ts
- sidebar.tsx
- ata.$token.tsx
- validation.ts
- bulk-demolay-ids.ts
- membros.novo.tsx
- calendar-types.ts
- realm.ts
- platform-access.functions.ts
- steps
- PageHeader
- server.ts
- components.json
- react
- __root.tsx
- compilerOptions
- TicketSellerRanking.tsx
- HubLanding.tsx
- membros.$id.tsx
- Documentação técnica — Templo Virtual
- menubar.tsx
- public-conference.functions.ts
- rate-limit.server.ts
- dues-rules.ts
- Templo Virtual — Projeto aberto e guia de contribuição
- SearchableSelect
- org-mandatory-dates.functions.ts
- finance-xlsx.ts
- class-variance-authority
- scripts
- lucide-react
- carousel.tsx
- cash-categories.ts
- CarteirinhaProficiencia.tsx
- start.ts
- index.ts
- ChapterSwitcher.tsx
- form.tsx
- event-finance.functions.ts
- ics.ts
- inicio.tsx
- Passeando pelo sistema
- vite.config.ts
- useOrgScope
- event-finance-export.test.ts
- Tutorial: sua primeira contribuição
- pagination.tsx
- Templo Virtual — Guia do Usuário
- exportEventFinancePdf
- FdjMembers.tsx
- sugestoes.tsx
- Futuro — filiações multi-corpo (discussão)
- OPEN-SOURCE.md
- updates
- Templo Virtual — Hub de gerenciamento das ordens paramaçônicas
- drawer.tsx
- navigation-menu.tsx
- CreateDialog
- Checklist manual — RBAC por papel (capítulo ativo)
- Documentação — Templo Virtual
- gen-favicon.mjs
- SindicanciaConfigPanel.tsx
- SphereAuth.tsx
- html5-qrcode
- regional.calendario.tsx
- router.tsx
- oficio-pdf.ts
- breadcrumb.tsx
- DayAgendaDialog.tsx
- vite-env.d.ts
- @radix-ui/react-aspect-ratio
- .prettierrc.json
- button.tsx
- SignaturePad
- Routes
- AGENTS.md
- cash-share.functions.ts
- @dnd-kit/sortable
- Templo Virtual · Redesign (handoff para implementação)
- MovedToConsole.tsx
- input-otp
- qrcode
- @radix-ui/react-avatar
- Templo Virtual · Redesign (handoff para implementação)
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-menubar
- 3. Arquitetura e fluxo de dados
- _app/route.tsx
- @radix-ui/react-slider
- ConsoleLogin
- ai
- clsx
- date-fns@^4.1.0
- react-markdown
- embla-carousel-react
- tailwind-merge
- @radix-ui/react-context-menu
- xlsx
- @radix-ui/react-radio-group
- @radix-ui/react-separator
- react-day-picker
- react-dom@^19.2.0
- SelectItem
- remark-gfm
- tailwindcss@^4.2.1
- tw-animate-css@^1.3.4

## God Nodes (most connected - your core abstractions)
1. `cn()` - 289 edges
2. `Button` - 236 edges
3. `Card` - 193 edges
4. `react` - 185 edges
5. `Input` - 144 edges
6. `lucide-react` - 137 edges
7. `Label` - 118 edges
8. `@tanstack/react-router` - 115 edges
9. `SelectContent` - 106 edges
10. `SelectTrigger` - 104 edges

## Surprising Connections (you probably didn't know these)
- `Camadas` --references--> `AppShell()`  [INFERRED]
  docs/TECNICO.md → src/components/shell/AppShell.tsx
- `Acoplamento mensalidade ↔ caixa` --references--> `duesDescription()`  [INFERRED]
  docs/TECNICO.md → src/lib/cash-categories.ts
- `Categorias em dois níveis` --references--> `resolveSubcategory()`  [INFERRED]
  docs/TECNICO.md → src/lib/cash-validation.server.ts
- `Variáveis de ambiente` --references--> `sendTransactionalEmail()`  [INFERRED]
  docs/TECNICO.md → src/lib/email.ts
- `3. Crie um branch` --references--> `main()`  [INFERRED]
  docs/OPEN-SOURCE.md → scripts/bulk-demolay-ids.ts

## Import Cycles
- None detected.

## Communities (163 total, 31 thin omitted)

### Community 0 - "gestao.tsx"
Cohesion: 0.12
Nodes (29): isFixedDemolayCommissionCode(), assertCanLinkCommissionModule(), chapterInput, COMMISSION_ROLE_ORDER, CommissionMemberRow, compareCommissionMembersByRoleName(), createChapterCommission, deleteChapterCommission (+21 more)

### Community 1 - "routeTree.gen.ts"
Cohesion: 0.02
Nodes (157): AtualizarCadastroPage(), Route, Route, Route, Route, Route, Route, Route (+149 more)

### Community 2 - "cn"
Cohesion: 0.07
Nodes (38): Avatar, AvatarFallback, AvatarImage, CardContent, CardDescription, CardFooter, CardHeader, CardTitle (+30 more)

### Community 3 - "MinuteBodyEditor.tsx"
Cohesion: 0.05
Nodes (65): ActiveSuggest, assignRef(), BalloonPos, getCaretOffsetInTextarea(), MinuteBodyEditor(), acceptMention(), acceptVar(), onKeyDown() (+57 more)

### Community 4 - "formatDateBR"
Cohesion: 0.20
Nodes (16): EmptyState(), Textarea, UnderConstruction(), formatDateBR(), chapterInput, createDuty, createMenu, deleteDuty (+8 more)

### Community 5 - "event-finance-export.ts"
Cohesion: 0.08
Nodes (29): CASH_COL_WEIGHT, COLOR_AMBER, COLOR_BLACK, COLOR_GRAY, COLOR_GREEN, COLOR_RED, ComandaReportItem, drawOpenLinesSection() (+21 more)

### Community 6 - "sonner"
Cohesion: 0.14
Nodes (26): sonner, DraftProps, OficioDraftPanel(), insertTemplate(), varContext(), OficioSignatures(), ViewProps, createOficioTemplate (+18 more)

### Community 7 - "auth-middleware.ts"
Cohesion: 0.10
Nodes (21): @supabase/supabase-js, createSupabaseFetch(), isNewSupabaseApiKey(), requireSupabaseAuth, CompositeTypes, Constants, Database, DatabaseWithoutInternals (+13 more)

### Community 8 - "SindicanciaAtaForm.tsx"
Cohesion: 0.09
Nodes (45): blockVisible(), prefillFromFile(), Props, SindicanciaAtaForm(), concludeAta(), downloadPdf(), firstMissingRequired(), revealField() (+37 more)

### Community 9 - "calendario.tsx"
Cohesion: 0.12
Nodes (35): useIsMobile(), assertMandatoryDateForChapter(), calendarTypeEnum, ChapterCalendarCategory, createCalendarItem, deleteCalendarItem, deleteChapterCalendarCategory, eventTypeEnum (+27 more)

### Community 10 - "sindicancias.sindicarias.tsx"
Cohesion: 0.08
Nodes (27): kindLabel(), MemberSearchSelect(), AtaFormMode, SheetFooter(), INVESTIGATION_STATUS_LABELS, InvestigationStatus, STATUS_LABELS, createSindicancia (+19 more)

### Community 11 - "investigations.functions.ts"
Cohesion: 0.06
Nodes (45): addressSchema, ALLOWED_IMAGE_MIMES, asAnswerMap(), asBlocks(), assertAllowedImageMime(), assertImageMagicBytes(), asSignatureMap(), attachMinuteAccess() (+37 more)

### Community 12 - "eventos.$id.tsx"
Cohesion: 0.07
Nodes (46): TicketPassProps, formatEventFinanceHint(), EVENT_FINANCE_GRACE_DAYS, eventDisplayStatusLabel(), assignSeat, createTable, createTicketType, deleteEvent (+38 more)

### Community 13 - "AppShell.tsx"
Cohesion: 0.10
Nodes (32): 5. Camada de serviço, AppShell(), ChapterMark(), PRELOAD_ROUTES, SidebarClock(), buildMobileTabs(), DesktopSidebar(), MobileTabBar() (+24 more)

### Community 14 - "membros.solicitacoes.tsx"
Cohesion: 0.20
Nodes (15): PageSkeleton(), formatChapterIdentity(), applyStatusSideEffects(), changeItemSchema, countPendingChangeRequests, KIND_VALUES, listPendingAffiliationRequests, listPendingChangeRequests (+7 more)

### Community 15 - "Label"
Cohesion: 0.09
Nodes (43): AuditLogFilterBar(), ChapterFormDialog(), ChapterFormInitial, Field(), SEMESTER_LABELS, TermSelect(), Label, labelVariants (+35 more)

### Community 16 - "timezone.ts"
Cohesion: 0.19
Nodes (18): ymdFromIso(), addDaysYmd(), assertEventFinanceOpen(), effectiveEventFinanceCloseYmd(), EVENT_DISPLAY_STATUS_LABELS, EventDbStatus, eventDisplayStatus, eventFinanceCloseYmd() (+10 more)

### Community 17 - "sindicancias.fichas.tsx"
Cohesion: 0.09
Nodes (44): DocPathsState, DocPreviewState, DocumentUploadFields(), emptyDocPaths(), Props, readFilePreview(), validateDocFile(), emptyInvestigationFile() (+36 more)

### Community 18 - "accounts.functions.ts"
Cohesion: 0.08
Nodes (49): AccessPreview(), MemberAccountPanel(), PasswordFields(), PasswordFieldsHandle, Props, createSupabaseAdminClient(), createSupabaseFetch(), isNewSupabaseApiKey() (+41 more)

### Community 19 - "membros.index.tsx"
Cohesion: 0.10
Nodes (28): FdjMembersList(), initials(), listKey(), ageFrom(), isMinor(), listMembers, stripMemberListPii(), membersListKey() (+20 more)

### Community 20 - "docs-catalog.ts"
Cohesion: 0.11
Nodes (30): DocsLayout(), DocsLayoutProps, DocsSidebar(), DocsSidebarProps, SidebarGroup(), flattenText(), Heading(), MarkdownDoc() (+22 more)

### Community 21 - "finance.functions.ts"
Cohesion: 0.09
Nodes (47): chargeCashDescription(), competenceLabel(), getChapterDefaultDuesAmount(), addChargePayment, adjustTrackedStock(), aggregateCashAmounts(), applyAutoStatusesForOpenDues(), bulkYearDuesAction (+39 more)

### Community 22 - "react"
Cohesion: 0.08
Nodes (26): react, MemberLite, Props, checkerboardStyle, Mode, Props, QrScanner(), BadgeProps (+18 more)

### Community 23 - "event-finance.functions.ts"
Cohesion: 0.16
Nodes (16): budgetExpenseName(), EventFinancePanel(), formatDateLabel(), mutationErrorMessage(), buildComandaReportRows(), exportEventTicketsXlsx(), deleteEventFinanceCategory, deleteEventFinanceItem (+8 more)

### Community 24 - "package.json"
Cohesion: 0.07
Nodes (27): @radix-ui/react-checkbox@^1.3.3, @radix-ui/react-collapsible@^1.1.12, @radix-ui/react-dialog@^1.1.15, @radix-ui/react-label@^2.1.8, @radix-ui/react-popover@^1.1.15, @radix-ui/react-scroll-area@^1.2.10, @radix-ui/react-select@^2.2.6, @radix-ui/react-switch@^1.2.6 (+19 more)

### Community 25 - "Button"
Cohesion: 0.08
Nodes (56): PositionListCard(), SortablePositionRow(), countVars(), DocumentTemplatesPanel(), previewSnippet(), Props, TemplateEditorCard(), CashColumnsPicker() (+48 more)

### Community 26 - "tesouraria.fluxo.tsx"
Cohesion: 0.07
Nodes (36): Expand(), SelectLabel, duesDescription(), ensureCashShareToken, getCashShareToken, revokeCashShareToken, createManualDuesEntry, deleteCashCategory (+28 more)

### Community 27 - "MemberFields.tsx"
Cohesion: 0.15
Nodes (26): InvestigationFileForm(), doLookupCep(), Field(), doLookupCep(), handleCepChange(), EditableGuardian, MyCadastroPanel(), doLookupCep() (+18 more)

### Community 28 - "org-join-request.functions.ts"
Cohesion: 0.08
Nodes (43): publicSenderKey(), ACTIVE_MEMBERS_BANDS, ActiveMembersBand, AnyClient, assertAdminTotal(), assertOrgJoinNotThrottled(), buildEmailBody(), countOpenOrgJoinInbox (+35 more)

### Community 29 - "@tanstack/react-router"
Cohesion: 0.09
Nodes (38): @tanstack/react-router, attendanceCellClass(), attendanceCellLetter(), eventSemester(), LobbyPresencasPage(), shortDate(), LobbyBackLink(), PublicLobbyContextValue (+30 more)

### Community 30 - "useActiveChapter"
Cohesion: 0.10
Nodes (33): MinutePasswordsCard(), PixKeyCard(), onQrFile(), removeQr(), Switch, useActiveChapter(), useChapterAccess(), chapterThemeSchema (+25 more)

### Community 31 - "permissions.ts"
Cohesion: 0.07
Nodes (49): CommissionAccess, useCommissionAccess(), isLinkedAdvisoryCouncil(), listMyCommissions, MyCommission, getMyCurrentPositions, groupAllowedByLegacy(), AccessContext (+41 more)

### Community 33 - "tesouraria.mensalidades.tsx"
Cohesion: 0.07
Nodes (34): DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent, DropdownMenuSubTrigger (+26 more)

### Community 34 - "ThemeToggle"
Cohesion: 0.11
Nodes (30): ThemeToggle(), PublicLobbyContext, applyChapterThemeVars(), applyPlatformDefaultThemeVars(), ChapterTheme, CORE_THEME_KEYS, darkenHex(), deriveThemeFromPrimary() (+22 more)

### Community 35 - "Card"
Cohesion: 0.06
Nodes (72): @tanstack/react-query, ChapterLogoAvatar(), SECTION_BY_PREFIX, TAB_ROOTS, PasswordField(), Card, Input, listMyChapterAccessLabels (+64 more)

### Community 36 - "position-catalog.functions.ts"
Cohesion: 0.20
Nodes (16): ROLE_GROUPS, RoleGroup, adminDb(), AnyClient, assertAdminTotal(), CatalogPosition, orgTypeSchema, PositionOrgTypeRow (+8 more)

### Community 37 - "screen-access.ts"
Cohesion: 0.07
Nodes (45): COMMISSION_MODULE_KEYS, COMMISSION_MODULES, CommissionModule, commissionModuleByKey(), CommissionModuleKey, effectiveCommissionModuleKey(), FIXED_DEMOLAY_COMMISSION_CODES, FIXED_DEMOLAY_COMMISSIONS (+37 more)

### Community 38 - "audit-log.ts"
Cohesion: 0.12
Nodes (28): assertCanViewChapterAudit(), asString(), listChapterAudit, payloadUuid(), withComandaNames(), ymdRangeIso(), asNumber(), asRecord() (+20 more)

### Community 39 - "Atrasados"
Cohesion: 0.08
Nodes (38): confirmItemPayment(), confirmReceiptPayment(), buildOverdueReportMessage(), buildReminderMessage(), buildWhatsAppUrl(), ChargeLike, classifyOpenChargesByMember(), classifyOverdueChargesByMember() (+30 more)

### Community 40 - "devDependencies"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^9.32.0, eslint-config-prettier@^10.1.1, @eslint/js@^9.32.0, eslint-plugin-prettier@^5.2.6, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.20, globals@^15.15.0 (+23 more)

### Community 41 - "instituicoes.$id.tsx"
Cohesion: 0.06
Nodes (88): ACTION_LABELS, actionLabel(), ActiveBadge(), AuditList(), ConsoleTitle(), errorText(), formatDateTime(), REALM_DOT (+80 more)

### Community 42 - "email-templates.ts"
Cohesion: 0.11
Nodes (30): appPublicOrigin(), bytesToBase64(), ChapterEmailAssets, loadChapterEmailAssets(), attachImage(), mimeFromPath(), normalizeChapterLogoPath(), EmailDeliveryStatus (+22 more)

### Community 43 - "formatBRL"
Cohesion: 0.17
Nodes (21): CheckoutData, ComandaReceiptBody(), formatMoneyFromDigits(), formatMoneyFromNumber(), invalidateComanda(), mutationErrorMessage(), parsePrice(), sanitizeIntegerQty() (+13 more)

### Community 44 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, @ai-sdk/openai-compatible@^3.0.14, cmdk@^1.1.1, @dnd-kit/core@^6.3.1, @dnd-kit/utilities@^3.2.2, @hookform/resolvers@^5.2.2, lucide-react@^0.575.0, @radix-ui/react-accordion@^1.2.12 (+29 more)

### Community 45 - "auth-nav-cache.ts"
Cohesion: 0.15
Nodes (22): SphereAuth(), clearMustChangePassword, getMemberLoginGate, getMustChangePassword, applyCachedRedirects(), AuthNavCache, enterAuthenticatedApp(), fetchAuthNavGates() (+14 more)

### Community 46 - "timezone.ts"
Cohesion: 0.17
Nodes (19): addressSchema, buildEndereco(), ChapterJoin, findLinkedMemberIds(), getMyDemolayProfile, guardianUpdateSchema, isoDateOnly(), issueProficiencyCard (+11 more)

### Community 47 - "atas.tsx"
Cohesion: 0.07
Nodes (60): DocTemplate, MinutesPanel(), persist(), persistDraft(), Props, STATUS_STYLE, Slider, saveMinutes (+52 more)

### Community 48 - "office-signatures.functions.ts"
Cohesion: 0.11
Nodes (26): canSignAs(), assertCanSignAsOffice(), canSignAsOffice, findMissingOfficeSignatures(), getOfficeSignaturesForChapter(), getRequiredOfficeSignature, listChapterOfficeSignatures, MyOfficeSignatureRow (+18 more)

### Community 49 - "resolve-linked-members.ts"
Cohesion: 0.39
Nodes (5): resolveLinkedMemberIds(), filterMembersVisibleInChapter(), resolveLinkedMemberIdsForChapter(), resolveLinkedMemberIdsGlobal(), SupabaseLike

### Community 50 - "member-documents.ts"
Cohesion: 0.13
Nodes (18): AgeBand, AtaBlockType, AtaTemplate, AtaTemplates, docColumnForKind(), EMPTY_ATA_TEMPLATES, LEGACY_ID_DOC_LABELS, LegacyIdDocKind (+10 more)

### Community 51 - "ChapterAuditPanel.tsx"
Cohesion: 0.14
Nodes (26): AuditLogFilterState, auditSeverityBadgeClass(), EMPTY_AUDIT_FILTERS, AREA_FILTERS, ChapterAuditPanel(), exportPdf(), matchesUser(), mutationErrorMessage() (+18 more)

### Community 52 - "ActiveChapterContext.tsx"
Cohesion: 0.10
Nodes (25): 7. Autenticação e autorização, Autorização em duas camadas, Fluxo de autenticação, Provisão de contas (MC / Admin Total), Visibilidade por comissão, ActiveChapterContext, ActiveChapterContextValue, ActiveChapterProvider() (+17 more)

### Community 53 - "PresencasAnalytics.tsx"
Cohesion: 0.09
Nodes (37): AttendanceOverviewCache, AttendanceRec, buildRecordMap(), CalItem, CELL_LABEL, CELL_LETTER, CELL_STYLE, cellStatus (+29 more)

### Community 54 - "org-public-path.functions.ts"
Cohesion: 0.21
Nodes (14): LOBBY_SECTION, lobbyMaskSection(), PublicTokenMask(), useLobbyPublicMask(), getChapterPublicSlug, getPublicSupabase(), PUBLIC_ORG_SECTIONS, PublicOrgPath (+6 more)

### Community 55 - "finance-pdf.ts"
Cohesion: 0.10
Nodes (32): Empty(), Metric(), monthName(), MONTHS, PublicCashFlowView(), handlePdf(), handleXlsx(), ReadOnlyTable() (+24 more)

### Community 56 - "chapter-logo.ts"
Cohesion: 0.16
Nodes (18): jspdf@^4.2.1, jspdf, blobToDataUrl(), ensurePdfLogoDataUrl(), loadLogoDataUrl(), normalizeChapterLogoPath(), prepareSvgBlob(), rasterizeToPngDataUrl() (+10 more)

### Community 57 - "sidebar.tsx"
Cohesion: 0.07
Nodes (37): Separator, SheetContent, SheetContentProps, SheetDescription, SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+29 more)

### Community 58 - "ata.$token.tsx"
Cohesion: 0.16
Nodes (22): getMinutePublicShareToken, getPublicMinute, getPublicMinuteByMember, getPublicSupabase(), getSessionSupabase(), minuteIdInput, minutePublicShareStorageKey(), MinutePublicVote (+14 more)

### Community 59 - "validation.ts"
Cohesion: 0.08
Nodes (34): zod@^3.24.2, zod, addressSchema, affiliateMemberToChapter, createInput, guardianSchema, kindEnum, listInput (+26 more)

### Community 60 - "bulk-demolay-ids.ts"
Cohesion: 0.20
Nodes (7): dir, esc(), raw, rows, values, files, findTests()

### Community 61 - "membros.novo.tsx"
Cohesion: 0.10
Nodes (36): ChapterOption, emptyGuardian, emptyMember, GuardianFields(), GuardianFormData, MemberDataFields(), MemberFormData, MemberKind (+28 more)

### Community 62 - "calendar-types.ts"
Cohesion: 0.17
Nodes (18): MyAttendancePanel(), listAttendanceOverview, listMinutesForEvent, listOngoingItems, setAttendance, base, turning21, ATTENDANCE_TYPES (+10 more)

### Community 63 - "realm.ts"
Cohesion: 0.18
Nodes (19): apexFromHostname(), getClientRealm(), getDevRealmOverride(), hostnameWithoutPort(), hubAbsoluteUrl(), isConsoleHostname(), isHubHost(), isLocalApexHostname() (+11 more)

### Community 64 - "platform-access.functions.ts"
Cohesion: 0.19
Nodes (20): orgTypeHasRoleGroups(), adminDb(), AnyClient, assertAdminTotal(), deletePlatformAccessRole, grantRowSchema, linkPlatformAccessRoleToPosition, listPlatformAccessMatrix (+12 more)

### Community 65 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, jobs, check, name, on, pull_request, push (+11 more)

### Community 66 - "PageHeader"
Cohesion: 0.07
Nodes (49): PageHeader(), MyPasswordPanel(), TabsContent, TabsList, TabsTrigger, useOngoingRealtime(), getOngoing, meetsVoteCadastro() (+41 more)

### Community 67 - "server.ts"
Cohesion: 0.16
Nodes (15): consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), APP_TIMEZONE, fetch() (+7 more)

### Community 68 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 69 - "react"
Cohesion: 0.31
Nodes (8): createSupabaseClient(), createSupabaseFetch(), isNewSupabaseApiKey(), cookieDomain(), cookieSecure(), deleteCookie(), supabaseAuthCookieStorage, writeCookie()

### Community 70 - "__root.tsx"
Cohesion: 0.16
Nodes (12): Toaster(), ToasterProps, applyTheme(), systemPrefersDark(), THEME_STORAGE_KEY, ThemeContext, ThemeContextValue, themeInitScript (+4 more)

### Community 71 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 72 - "TicketSellerRanking.tsx"
Cohesion: 0.14
Nodes (17): EditableTicket, EditSoldTicketDialog(), handleTypeChange(), mutationErrorMessage(), TicketType, typePrice(), buildRanking(), buildSellerRankingMessage() (+9 more)

### Community 73 - "HubLanding.tsx"
Cohesion: 0.13
Nodes (19): AUDIENCES, FAQ, HubLanding(), MODULES, NAV_LINKS, PageHead(), useReveal(), PlaceholderShot() (+11 more)

### Community 74 - "membros.$id.tsx"
Cohesion: 0.10
Nodes (35): getMemberAttendance, getMemberFinance, isAptoGrauDemolay(), isSameChapter(), revealMemberPii, affiliatedOrgsHeading(), formatPositionOptionLabel(), initiationOrgFieldLabel() (+27 more)

### Community 75 - "Documentação técnica — Templo Virtual"
Cohesion: 0.10
Nodes (21): 10. Ambiente e configuração, 11. Scripts, build e deploy, 12. Estado atual e lacunas conhecidas, 13. Manutenção desta documentação, 1. Visão geral, 2. Estrutura de diretórios, 4. Convenções de arquivo (importante), 6. Modelo de dados (+13 more)

### Community 76 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 77 - "public-conference.functions.ts"
Cohesion: 0.16
Nodes (15): PrazoKind, getPublicCalendar, getPublicNominata, getPublicSupabase(), PublicCalendarCategory, PublicCalendarItem, PublicCalendarPayload, PublicConferenceChapter (+7 more)

### Community 78 - "rate-limit.server.ts"
Cohesion: 0.18
Nodes (6): supabaseAdmin, assertAiQuota(), composeEventDescription, improveText, requireAiKey(), QuotaScope

### Community 79 - "dues-rules.ts"
Cohesion: 0.25
Nodes (16): autoDueExemptKind(), autoDueStatus(), AutoExemptKind, AwayPeriod, cmpYm(), cmpYmd(), DEFAULT_DUES_AMOUNT, DUES_ONLY_NAV_PATHS (+8 more)

### Community 80 - "Templo Virtual — Projeto aberto e guia de contribuição"
Cohesion: 0.13
Nodes (15): Banco de dados, Começando (setup local), Código de conduta, Licença, Modelo de `.env`, Mudanças no banco de dados, Organização do repositório, Padrões de código (+7 more)

### Community 81 - "SearchableSelect"
Cohesion: 0.32
Nodes (11): SearchableOption, SearchableSelect(), Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem (+3 more)

### Community 82 - "org-mandatory-dates.functions.ts"
Cohesion: 0.18
Nodes (18): assertDayInMonth(), dayOfYearKey(), DAYS_IN_MONTH, daysInMonth(), formatDayMonth(), formatPrazoLabel(), listMandatoryDatesForChapter, listMandatoryDatesForChapterMonth (+10 more)

### Community 83 - "finance-xlsx.ts"
Cohesion: 0.16
Nodes (15): 9. Módulo Financeiro, Acoplamento mensalidade ↔ caixa, Categorias em dois níveis, Controle de acesso do módulo, Importação, exportação e relatório, downloadCashTemplate(), loadXlsx(), parseCashSheet() (+7 more)

### Community 84 - "class-variance-authority"
Cohesion: 0.20
Nodes (11): class-variance-authority@^0.7.1, class-variance-authority, Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext (+3 more)

### Community 85 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, build:dev, check, dev, dev:fdj, dev:hub, dev:loja (+6 more)

### Community 86 - "lucide-react"
Cohesion: 0.13
Nodes (26): lucide-react, formatPositionHistoryLine(), PositionHistoryCollapsible(), PositionHistoryItem, COMMISSION_ROLE_LABELS, MyHistoryPanel(), Props, getMyMemberOrgHistory (+18 more)

### Community 87 - "carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 88 - "cash-categories.ts"
Cohesion: 0.18
Nodes (13): cashEntryMatchesCharge(), competenceShortLabel(), DYNAMIC_CATEGORIES, DynamicScope, FIXED_CATEGORIES, foldPt(), MONTH_NAMES, SCOPE_LABELS (+5 more)

### Community 89 - "CarteirinhaProficiencia.tsx"
Cohesion: 0.21
Nodes (13): carteirinhaDialogClassName, CarteirinhaProficiencia(), classeNome(), dataCurta(), dataExtenso(), FaceFrente(), FaceVerso(), MESES (+5 more)

### Community 90 - "start.ts"
Cohesion: 0.20
Nodes (12): @tanstack/react-start@^1.168.60, @tanstack/react-start, attachSupabaseAuth, CONSTRAINT_MESSAGES, isControlFlowError(), RULES, SESSION_EXPIRED_MESSAGE, userFacingMessage() (+4 more)

### Community 91 - "index.ts"
Cohesion: 0.22
Nodes (8): b64decode(), b64encode(), EmailActionType, headerOf(), HookPayload, loadTvLogoPng(), timingSafeEqual(), verifyStandardWebhook()

### Community 92 - "ChapterSwitcher.tsx"
Cohesion: 0.14
Nodes (19): ChapterRow(), ChapterSwitcherMenu(), SwitcherEntry, Card(), CardTitle(), Chip(), FinanceCard(), HomeShortcut (+11 more)

### Community 93 - "form.tsx"
Cohesion: 0.23
Nodes (10): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+2 more)

### Community 94 - "event-finance.functions.ts"
Cohesion: 0.15
Nodes (25): addEventBudgetExpense, assertBudgetCashEntry(), assertComandaEditable(), BUDGET_CATEGORY_NAME, BudgetExpenseClient, checkoutEventTicketComanda, COMANDA_AUDIT_ACTIONS, deleteEventBudgetExpense (+17 more)

### Community 95 - "ics.ts"
Cohesion: 0.23
Nodes (14): buildIcs(), downloadIcs(), endOrDefault(), escapeIcs(), fullLocation(), googleCalendarUrl(), IcsInviteOptions, IcsItem (+6 more)

### Community 96 - "inicio.tsx"
Cohesion: 0.14
Nodes (20): ChapterSwitcher(), initialsOf(), listEvents, listYearDues, parseDateOnly(), listOpenSindicanciasForMe, listChapterMinutes, birthdayDayMonthLabel() (+12 more)

### Community 97 - "Passeando pelo sistema"
Cohesion: 0.18
Nodes (11): Comissão de Eventos, Comissão de Sindicâncias, Documentação, Gestão, Hospitalaria, Início, Passeando pelo sistema, Perfil (+3 more)

### Community 98 - "vite.config.ts"
Cohesion: 0.18
Nodes (10): @tailwindcss/vite@^4.2.1, vite-tsconfig-paths@^6.0.2, nitro@3.0.260603-beta, vite@^8.0.16, @vitejs/plugin-react@^5.2.0, nitro, @tailwindcss/vite, vite (+2 more)

### Community 99 - "useOrgScope"
Cohesion: 0.17
Nodes (16): handleSignOut(), clearChapterSessionStorage(), OrgScope, OrgScopeContext, OrgScopeContextValue, ROLE_PREFIX, useOrgScope(), useNavBadges() (+8 more)

### Community 100 - "event-finance-export.test.ts"
Cohesion: 0.12
Nodes (20): budgetExpenseShortName(), buildSimpleEventExpenseLines(), buildSimpleEventIncomeLines(), ComandaReportRow, defaultEventCashTableColumns(), drawCashKindTable(), formatEventCashRowTexts(), isBudgetLikeCashRow() (+12 more)

### Community 101 - "Tutorial: sua primeira contribuição"
Cohesion: 0.13
Nodes (17): 1. Fork do repositório, 2. Clone o seu fork, 3. Crie um branch, 4. Faça a alteração, 5. Adicione e faça o commit, 6. Envie o branch para o seu fork, 7. Abra o Pull Request, Antes de marcar o PR como pronto (+9 more)

### Community 102 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 103 - "Templo Virtual — Guia do Usuário"
Cohesion: 0.22
Nodes (9): Como funciona o acesso, Cuidado com os dados pessoais, Glossário, Manutenção deste guia, O que cada cargo pode fazer, O que é o Templo Virtual, Para quem é, Perguntas frequentes (+1 more)

### Community 104 - "exportEventFinancePdf"
Cohesion: 0.17
Nodes (21): buildEventReportAnalysis(), cashCellText(), drawAnalysisSection(), drawCategorySection(), drawChartsPage(), drawPaidSpentOpen(), drawPieChart(), drawPieLegend() (+13 more)

### Community 105 - "FdjMembers.tsx"
Cohesion: 0.10
Nodes (42): 8. PII e LGPD, AccessSection(), AccountResult, BackLink(), emptyForm, FdjMemberCreate(), FdjMemberDetail(), FdjMemberEdit() (+34 more)

### Community 106 - "sugestoes.tsx"
Cohesion: 0.44
Nodes (7): getTechCommissionContacts(), getTechCommissionEmails(), parseContactsJson(), readEnv(), TechCommissionContact, loadTechContacts, Route

### Community 107 - "Futuro — filiações multi-corpo (discussão)"
Cohesion: 0.25
Nodes (7): Contexto, Corpos previstos, Faixas etárias de referência (validar com a equipe), Fora de escopo agora, Futuro — filiações multi-corpo (discussão), Implicações técnicas (rascunho), Próximo passo sugerido

### Community 109 - "updates"
Cohesion: 0.25
Nodes (7): interval, updates, directory, open-pull-requests-limit, package-ecosystem, schedule, version

### Community 110 - "Templo Virtual — Hub de gerenciamento das ordens paramaçônicas"
Cohesion: 0.25
Nodes (8): Contribuindo, Documentação, Início rápido, Licença, O que faz, Scripts, Stack, Templo Virtual — Hub de gerenciamento das ordens paramaçônicas

### Community 111 - "drawer.tsx"
Cohesion: 0.29
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 112 - "navigation-menu.tsx"
Cohesion: 0.32
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 113 - "CreateDialog"
Cohesion: 0.15
Nodes (13): AccordionContent, AccordionItem, AccordionTrigger, at(), isSessionType(), fromAppTzDateTimeLocal(), appTzDateAt(), CreateDialog() (+5 more)

### Community 114 - "Checklist manual — RBAC por papel (capítulo ativo)"
Cohesion: 0.33
Nodes (5): Assinaturas oficiais, Cadastro global, Checklist manual — RBAC por papel (capítulo ativo), Escopo de capítulo (multifiliação), Testes automatizados da matriz

### Community 115 - "Documentação — Templo Virtual"
Cohesion: 0.33
Nodes (6): Checklist rápido antes de abrir o PR, Discussão interna (fora do app), Documentação — Templo Virtual, Os três documentos, Qual documento atualizar, Regra de manutenção da documentação

### Community 117 - "SindicanciaConfigPanel.tsx"
Cohesion: 0.19
Nodes (12): SINDICANCIA_CHAVE_VAR_TOKENS, SindicanciaConfigPanel(), DEFAULT_SINDICANCIA_CHAVE, DEFAULT_SINDICANCIA_PARECER, ensureInvestigationSignupToken, getInvestigationSignupToken, patchChapterSettings(), revokeInvestigationSignupToken (+4 more)

### Community 118 - "SphereAuth.tsx"
Cohesion: 0.15
Nodes (11): Props, SPHERE_THEMES, SphereLoginFields, SphereTheme, Realm, REALM_CARD_BLURB, REALMS, ChapterJoin (+3 more)

### Community 120 - "regional.calendario.tsx"
Cohesion: 0.29
Nodes (12): addOneDayYmd(), CalendarAgendaView(), CalendarMonthView(), itemDayKeys(), occursOnDay(), SharedCalendarItem, toLocalDateKey(), CALENDAR_TYPES (+4 more)

### Community 121 - "router.tsx"
Cohesion: 0.32
Nodes (6): DelayedPageSkeleton(), DelayedSuspenseFallback(), getRouter(), Register, routeTree, startInstance

### Community 122 - "oficio-pdf.ts"
Cohesion: 0.31
Nodes (12): OficioDocumentHeader(), OficioViewPanel(), chapterOrdemLabel(), drawOficioHeader(), drawSignatures(), exportOficioPdf(), fileSafe(), formatOficioDate() (+4 more)

### Community 123 - "breadcrumb.tsx"
Cohesion: 0.20
Nodes (9): @radix-ui/react-slot@^1.2.4, @radix-ui/react-slot, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage (+1 more)

### Community 124 - "DayAgendaDialog.tsx"
Cohesion: 0.39
Nodes (8): capitalize(), dateFromKey(), DayAgendaDialog(), DayAgendaItem, DayAgendaRow(), shiftDayKey(), shortDate(), TimeState

### Community 125 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, *.md?raw

### Community 128 - "button.tsx"
Cohesion: 0.14
Nodes (27): ConfirmDialogOptions, useConfirmDialog(), ListKey, PositionCatalogManager(), idsForList(), onDragEnd(), scopesFor(), AlertDialogAction (+19 more)

### Community 129 - "SignaturePad"
Cohesion: 0.33
Nodes (6): SignaturePad(), capturePhoto(), clear(), startCamera(), stopCamera(), switchMode()

### Community 132 - "cash-share.functions.ts"
Cohesion: 0.31
Nodes (8): chapterInput, getPublicCashFlow, getPublicSupabase(), PublicCashChapter, PublicCashEntry, PublicCashFlowPayload, throwPublicRpcError(), tryLoadLogoDataUrl()

### Community 134 - "Templo Virtual · Redesign (handoff para implementação)"
Cohesion: 0.25
Nodes (7): Mapeamento para o seletor de tema existente, Menu lateral (Sidebar.dc.html), Pendências, Regras de acessibilidade, Telas, Templo Virtual · Redesign (handoff para implementação), Tokens

### Community 135 - "MovedToConsole.tsx"
Cohesion: 0.52
Nodes (4): MovedToConsole(), consoleAbsoluteUrl(), Route, Route

### Community 139 - "Templo Virtual · Redesign (handoff para implementação)"
Cohesion: 0.33
Nodes (5): Pendências, Regras de acessibilidade, Telas, Templo Virtual · Redesign (handoff para implementação), Tokens

### Community 143 - "3. Arquitetura e fluxo de dados"
Cohesion: 0.40
Nodes (5): 3. Arquitetura e fluxo de dados, Camadas, Caminho completo de uma requisição, Exceções ao caminho acima, Pontos de entrada

### Community 144 - "_app/route.tsx"
Cohesion: 0.40
Nodes (3): ConsoleLayout(), NAV, Route

### Community 146 - "ConsoleLogin"
Cohesion: 0.50
Nodes (3): ConsoleLogin(), onPassword(), resolveStep()

### Community 159 - "SelectItem"
Cohesion: 0.13
Nodes (30): DUE_STATUS_LABEL, MyFinancePanel(), DUE_STATUS_LABEL, LobbyMemberPortalPage(), logout(), MemberCadastroTab(), MemberChargesTab(), MemberFrequencyTab() (+22 more)

## Knowledge Gaps
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `button.tsx`, `gestao.tsx`, `cn`, `MinuteBodyEditor.tsx`, `formatDateBR`, `sonner`, `SindicanciaAtaForm.tsx`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `eventos.$id.tsx`, `AppShell.tsx`, `Label`, `_app/route.tsx`, `sindicancias.fichas.tsx`, `accounts.functions.ts`, `membros.index.tsx`, `docs-catalog.ts`, `event-finance.functions.ts`, `package.json`, `Button`, `tesouraria.fluxo.tsx`, `MemberFields.tsx`, `org-join-request.functions.ts`, `@tanstack/react-router`, `useActiveChapter`, `SelectItem`, `permissions.ts`, `tesouraria.mensalidades.tsx`, `ThemeToggle`, `Card`, `instituicoes.$id.tsx`, `formatBRL`, `dependencies`, `auth-nav-cache.ts`, `atas.tsx`, `office-signatures.functions.ts`, `ChapterAuditPanel.tsx`, `ActiveChapterContext.tsx`, `PresencasAnalytics.tsx`, `finance-pdf.ts`, `chapter-logo.ts`, `sidebar.tsx`, `ata.$token.tsx`, `membros.novo.tsx`, `calendar-types.ts`, `PageHeader`, `__root.tsx`, `TicketSellerRanking.tsx`, `HubLanding.tsx`, `membros.$id.tsx`, `menubar.tsx`, `SearchableSelect`, `class-variance-authority`, `lucide-react`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `ChapterSwitcher.tsx`, `form.tsx`, `inicio.tsx`, `useOrgScope`, `pagination.tsx`, `FdjMembers.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `CreateDialog`, `SindicanciaConfigPanel.tsx`, `SphereAuth.tsx`, `regional.calendario.tsx`, `router.tsx`, `breadcrumb.tsx`, `DayAgendaDialog.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `gestao.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11895161290322581 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `cn` to `button.tsx`, `SignaturePad`, `MinuteBodyEditor.tsx`, `formatDateBR`, `sindicancias.sindicarias.tsx`, `eventos.$id.tsx`, `AppShell.tsx`, `Label`, `docs-catalog.ts`, `react`, `Button`, `tesouraria.fluxo.tsx`, `useActiveChapter`, `SelectItem`, `tesouraria.mensalidades.tsx`, `Card`, `instituicoes.$id.tsx`, `formatBRL`, `atas.tsx`, `ChapterAuditPanel.tsx`, `PresencasAnalytics.tsx`, `finance-pdf.ts`, `sidebar.tsx`, `PageHeader`, `TicketSellerRanking.tsx`, `HubLanding.tsx`, `menubar.tsx`, `SearchableSelect`, `class-variance-authority`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `ChapterSwitcher.tsx`, `form.tsx`, `pagination.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `CreateDialog`, `breadcrumb.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.015636690109232382 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `Button` to `button.tsx`, `SignaturePad`, `cn`, `MinuteBodyEditor.tsx`, `routeTree.gen.ts`, `gestao.tsx`, `sonner`, `MovedToConsole.tsx`, `SindicanciaAtaForm.tsx`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `formatDateBR`, `eventos.$id.tsx`, `AppShell.tsx`, `membros.solicitacoes.tsx`, `Label`, `sindicancias.fichas.tsx`, `accounts.functions.ts`, `membros.index.tsx`, `docs-catalog.ts`, `ConsoleLogin`, `react`, `event-finance.functions.ts`, `tesouraria.fluxo.tsx`, `MemberFields.tsx`, `useActiveChapter`, `SelectItem`, `tesouraria.mensalidades.tsx`, `ThemeToggle`, `Card`, `Atrasados`, `instituicoes.$id.tsx`, `formatBRL`, `atas.tsx`, `ChapterAuditPanel.tsx`, `finance-pdf.ts`, `sidebar.tsx`, `ata.$token.tsx`, `membros.novo.tsx`, `PageHeader`, `TicketSellerRanking.tsx`, `membros.$id.tsx`, `SearchableSelect`, `lucide-react`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `ChapterSwitcher.tsx`, `ics.ts`, `FdjMembers.tsx`, `sugestoes.tsx`, `CreateDialog`, `SindicanciaConfigPanel.tsx`, `regional.calendario.tsx`, `oficio-pdf.ts`, `DayAgendaDialog.tsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.07342995169082125 - nodes in this community are weakly interconnected._
- **Should `MinuteBodyEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05136986301369863 - nodes in this community are weakly interconnected._