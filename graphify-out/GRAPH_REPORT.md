# Graph Report - sgc-dm  (2026-11-21)

## Corpus Check
- 598 files · ~537,847 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 5, .css 4, .example 2)

## Summary
- 3801 nodes · 13927 edges · 167 communities (133 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `196f9dac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- regional.calendario.tsx
- routeTree.gen.ts
- cn
- MinuteBodyEditor.tsx
- formatDateBR
- event-finance-export.ts
- sonner
- lobby-share.functions.ts
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
- eventos.checkins.tsx
- event-finance.functions.ts
- package.json
- Button
- tesouraria.fluxo.tsx
- format.ts
- org-join-request.functions.ts
- @tanstack/react-router
- configuracoes.tsx
- permissions.ts
- tesouraria.cobrancas.tsx
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
- MinutesPanel.tsx
- office-signatures.functions.ts
- FileRoutesByPath
- atas.tsx
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
- ongoing.$id.tsx
- realm.ts
- DialogContent
- steps
- presencas.tsx
- server.ts
- components.json
- react
- __root.tsx
- compilerOptions
- TicketSellerRanking.tsx
- SupademoEmbed.tsx
- membros.$id.tsx
- Documentação técnica — Templo Virtual
- menubar.tsx
- public-conference.functions.ts
- @tanstack/react-start
- dues-rules.ts
- Templo Virtual — Projeto aberto e guia de contribuição
- SearchableSelect
- org-mandatory-dates.functions.ts
- presencas-xlsx.ts
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
- perfil.tsx
- ics.ts
- inicio.tsx
- Passeando pelo sistema
- vite.config.ts
- chave-do-dia.ts
- event-finance-export.test.ts
- Tutorial: sua primeira contribuição
- pagination.tsx
- Templo Virtual — Guia do Usuário
- nav.ts
- FdjMembers.tsx
- sugestoes.tsx
- Futuro — filiações multi-corpo (discussão)
- OPEN-SOURCE.md
- updates
- Templo Virtual — Hub de gerenciamento das ordens paramaçônicas
- calendar-pdf.ts
- navigation-menu.tsx
- finance-pdf.ts
- Checklist manual — RBAC por papel (capítulo ativo)
- Documentação — Templo Virtual
- gen-favicon.mjs
- sindicancias.config.tsx
- CalendarioPage
- html5-qrcode
- DayAgendaDialog.tsx
- client.server.ts
- minute-vars.ts
- rate-limit.server.ts
- minute-kinds.ts
- vite-env.d.ts
- @radix-ui/react-aspect-ratio
- .prettierrc.json
- useConfirmDialog
- SignaturePad
- Routes
- AGENTS.md
- chapter.functions.ts
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
- ConsoleLayout
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
- chart.tsx
- storageKey
- atualizar-cadastro.tsx
- documentacao/route.tsx

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
10. `useActiveChapter()` - 105 edges

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

## Communities (167 total, 34 thin omitted)

### Community 0 - "regional.calendario.tsx"
Cohesion: 0.15
Nodes (23): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, useIsMobile(), listCalendarItems, parseCalendarTypeLabels() (+15 more)

### Community 1 - "routeTree.gen.ts"
Cohesion: 0.02
Nodes (119): Route, Route, Route, AtaTokenRoute, AtualizarCadastroRoute, AuthAdicionarOrganizacaoRoute, AuthAssinaturaRoute, AuthenticatedRouteRoute (+111 more)

### Community 2 - "cn"
Cohesion: 0.05
Nodes (53): Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList (+45 more)

### Community 3 - "MinuteBodyEditor.tsx"
Cohesion: 0.13
Nodes (25): ActiveSuggest, assignRef(), BalloonPos, getCaretOffsetInTextarea(), MinuteBodyEditor(), acceptMention(), acceptVar(), onKeyDown() (+17 more)

### Community 4 - "formatDateBR"
Cohesion: 0.14
Nodes (16): countVars(), DocumentTemplatesPanel(), previewSnippet(), TemplateEditorCard(), EmptyState(), UnderConstruction(), chapterInput, createDuty (+8 more)

### Community 5 - "event-finance-export.ts"
Cohesion: 0.06
Nodes (62): generate(), formatDateLabel(), gestaoFromEventDate(), listLodges, budgetExpenseShortName(), buildEventReportAnalysis(), buildSimpleEventExpenseLines(), CASH_COL_WEIGHT (+54 more)

### Community 6 - "sonner"
Cohesion: 0.14
Nodes (31): readAutocompletePref(), writeAutocompletePref(), insertTemplate(), DraftProps, OficioDocumentHeader(), OficioDraftPanel(), insertTemplate(), varContext() (+23 more)

### Community 7 - "lobby-share.functions.ts"
Cohesion: 0.08
Nodes (30): @supabase/supabase-js, CompositeTypes, Constants, Database, DatabaseWithoutInternals, DefaultSchema, Enums, Json (+22 more)

### Community 8 - "SindicanciaAtaForm.tsx"
Cohesion: 0.08
Nodes (48): AtaFormMode, blockVisible(), prefillFromFile(), Props, SindicanciaAtaForm(), concludeAta(), downloadPdf(), firstMissingRequired() (+40 more)

### Community 9 - "calendario.tsx"
Cohesion: 0.14
Nodes (24): AccordionContent, AccordionItem, AccordionTrigger, assertMandatoryDateForChapter(), calendarTypeEnum, ChapterCalendarCategory, createCalendarItem, deleteChapterCalendarCategory (+16 more)

### Community 10 - "sindicancias.sindicarias.tsx"
Cohesion: 0.09
Nodes (26): SINDICANCIA_CHAVE_VAR_TOKENS, SindicanciaConfigPanel(), Textarea, useCommissionAccess(), INVESTIGATION_STATUS_LABELS, InvestigationStatus, STATUS_LABELS, createSindicancia (+18 more)

### Community 11 - "investigations.functions.ts"
Cohesion: 0.04
Nodes (73): normalizeWhatsAppDigits(), sendTransactionalEmail(), addressSchema, ALLOWED_IMAGE_MIMES, asAnswerMap(), asBlocks(), assertAllowedImageMime(), assertImageMagicBytes() (+65 more)

### Community 12 - "eventos.$id.tsx"
Cohesion: 0.07
Nodes (53): TicketComandaButton(), TicketPass(), summarizeEmailResult(), buildComandaReportRows(), formatEventFinanceHint(), deleteEventTicket, EVENT_FINANCE_GRACE_DAYS, assignSeat (+45 more)

### Community 13 - "AppShell.tsx"
Cohesion: 0.10
Nodes (33): AppShell(), handleSignOut(), ChapterMark(), PRELOAD_ROUTES, SidebarClock(), buildMobileTabs(), DesktopSidebar(), MobileTabBar() (+25 more)

### Community 14 - "membros.solicitacoes.tsx"
Cohesion: 0.21
Nodes (14): formatChapterIdentity(), applyStatusSideEffects(), changeItemSchema, countPendingChangeRequests, KIND_VALUES, listPendingAffiliationRequests, listPendingChangeRequests, MASTER_FIELDS (+6 more)

### Community 15 - "Label"
Cohesion: 0.13
Nodes (29): MemberFrequencyTab(), SEMESTER_LABELS, TermSelect(), SelectContent, SelectItem, SelectScrollDownButton, SelectScrollUpButton, SelectTrigger (+21 more)

### Community 16 - "timezone.ts"
Cohesion: 0.31
Nodes (12): addDaysYmd(), assertEventFinanceOpen(), effectiveEventFinanceCloseYmd(), EVENT_DISPLAY_STATUS_LABELS, EventDbStatus, eventDisplayStatus, eventDisplayStatusLabel(), eventFinanceCloseYmd() (+4 more)

### Community 17 - "sindicancias.fichas.tsx"
Cohesion: 0.09
Nodes (50): Field(), DocPathsState, DocPreviewState, DocumentUploadFields(), emptyDocPaths(), Props, readFilePreview(), validateDocFile() (+42 more)

### Community 18 - "accounts.functions.ts"
Cohesion: 0.13
Nodes (28): accessSummaryFrom(), AdminClient, assertCanManageMemberAccounts(), assertLoginNotLocked(), clearLoginFailures(), clientIpForLogin(), ensureChapterLobbyTokenForInvite(), ensureChapterMembership() (+20 more)

### Community 19 - "membros.index.tsx"
Cohesion: 0.13
Nodes (20): listMembers, stripMemberListPii(), ActiveChapter, Avatar(), DEFAULT_FILTERS, filtersKey(), FILTRO_VALUES, KIND_VALUES (+12 more)

### Community 20 - "docs-catalog.ts"
Cohesion: 0.11
Nodes (30): DocsLayout(), DocsLayoutProps, DocsSidebar(), DocsSidebarProps, SidebarGroup(), flattenText(), Heading(), MarkdownDoc() (+22 more)

### Community 21 - "finance.functions.ts"
Cohesion: 0.09
Nodes (45): competenceLabel(), getChapterDefaultDuesAmount(), createEvent, adjustTrackedStock(), aggregateCashAmounts(), applyAutoStatusesForOpenDues(), bulkYearDuesAction, CashAggRow (+37 more)

### Community 22 - "eventos.checkins.tsx"
Cohesion: 0.15
Nodes (13): QrScanner(), useEventCheckinRealtime(), listChapterTicketsForCheckin, Checkins(), openManual(), CheckinTicketsResult, EventRow, mutationErrorMessage() (+5 more)

### Community 23 - "event-finance.functions.ts"
Cohesion: 0.08
Nodes (35): budgetExpenseName(), EventFinancePanel(), formatDateLabel(), mutationErrorMessage(), addEventBudgetExpense, assertBudgetCashEntry(), BUDGET_CATEGORY_NAME, BudgetExpenseClient (+27 more)

### Community 24 - "package.json"
Cohesion: 0.07
Nodes (27): @radix-ui/react-checkbox@^1.3.3, @radix-ui/react-collapsible@^1.1.12, @radix-ui/react-dialog@^1.1.15, @radix-ui/react-label@^2.1.8, @radix-ui/react-popover@^1.1.15, @radix-ui/react-scroll-area@^1.2.10, @radix-ui/react-select@^2.2.6, @radix-ui/react-switch@^1.2.6 (+19 more)

### Community 25 - "Button"
Cohesion: 0.07
Nodes (59): lucide-react, react, sonner, @tanstack/react-query, ChapterFormInitial, Props, EditableTicket, TicketType (+51 more)

### Community 26 - "tesouraria.fluxo.tsx"
Cohesion: 0.07
Nodes (36): SelectLabel, chapterInput, ensureCashShareToken, getCashShareToken, getPublicCashFlow, getPublicSupabase(), PublicCashChapter, PublicCashFlowPayload (+28 more)

### Community 27 - "format.ts"
Cohesion: 0.10
Nodes (46): doLookupCep(), ChapterOption, emptyGuardian, emptyMember, Field(), GUARDIAN_RELATIONSHIPS, GuardianFields(), GuardianFormData (+38 more)

### Community 28 - "org-join-request.functions.ts"
Cohesion: 0.10
Nodes (37): ACTIVE_MEMBERS_BANDS, ActiveMembersBand, AnyClient, assertAdminTotal(), assertOrgJoinNotThrottled(), buildEmailBody(), digitsOnlyPhone(), formatFoundedOn() (+29 more)

### Community 29 - "@tanstack/react-router"
Cohesion: 0.11
Nodes (29): @tanstack/react-router, attendanceCellClass(), attendanceCellLetter(), eventSemester(), LobbyPresencasPage(), shortDate(), cellClass(), cellLetter() (+21 more)

### Community 30 - "configuracoes.tsx"
Cohesion: 0.08
Nodes (33): TabsContent, TabsList, TabsTrigger, deleteLodge, saveLodge, updateChapterProfile, ensurePublicLobbyToken, getPublicLobbyToken (+25 more)

### Community 31 - "permissions.ts"
Cohesion: 0.07
Nodes (50): CHAVE_VAR_TOKENS, ChaveTemplateCard(), useActiveChapter(), useChapterAccess(), CommissionAccess, updateChaveTemplate, chavePreviewItem(), isLinkedAdvisoryCouncil() (+42 more)

### Community 32 - "tesouraria.cobrancas.tsx"
Cohesion: 0.10
Nodes (30): chargeCashDescription(), memberChargeAmountSchema, parseChargeAmount(), addChargePayment, deleteChargePayment, deleteMemberCharge, findReusableChargeCashEntry(), listCashCategories (+22 more)

### Community 33 - "tesouraria.mensalidades.tsx"
Cohesion: 0.07
Nodes (33): Expand(), buildReminderMessage(), buildWhatsAppUrl(), firstNameFromFullName(), chapterInput, ensureDuesShareToken, getDuesShareToken, getPublicSupabase() (+25 more)

### Community 34 - "ThemeToggle"
Cohesion: 0.11
Nodes (32): ThemeToggle(), PublicLobbyContext, useTheme(), updateChapterAccentColor, applyChapterThemeVars(), applyPlatformDefaultThemeVars(), ChapterTheme, CORE_THEME_KEYS (+24 more)

### Community 35 - "Card"
Cohesion: 0.08
Nodes (49): ChapterLogoAvatar(), PageHeader(), assertCanManageOrg(), assertCanManageRegionChapters(), assertCanWriteChapterScope(), createScopeMember, deleteState, ensureScopeChapterPublicLink (+41 more)

### Community 36 - "position-catalog.functions.ts"
Cohesion: 0.14
Nodes (24): ListKey, PositionCatalogManager(), idsForList(), onDragEnd(), scopesFor(), PositionListCard(), SortablePositionRow(), OrgType (+16 more)

### Community 37 - "screen-access.ts"
Cohesion: 0.05
Nodes (66): COMMISSION_MODULE_KEYS, COMMISSION_MODULES, CommissionModule, CommissionModuleKey, effectiveCommissionModuleKey(), FIXED_DEMOLAY_COMMISSION_CODES, FIXED_DEMOLAY_COMMISSIONS, FixedDemolayCommission (+58 more)

### Community 38 - "audit-log.ts"
Cohesion: 0.11
Nodes (30): assertCanViewChapterAudit(), asString(), ChapterAuditRow, listChapterAudit, payloadUuid(), withComandaNames(), ymdRangeIso(), asNumber() (+22 more)

### Community 39 - "Atrasados"
Cohesion: 0.20
Nodes (12): buildOverdueReportMessage(), getFinanceSigners, Atrasados(), copyMessage(), copyReport(), messageFor(), openBulkEmail(), openReport() (+4 more)

### Community 40 - "devDependencies"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^9.32.0, eslint-config-prettier@^10.1.1, @eslint/js@^9.32.0, eslint-plugin-prettier@^5.2.6, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.20, globals@^15.15.0 (+23 more)

### Community 41 - "instituicoes.$id.tsx"
Cohesion: 0.05
Nodes (81): ACTION_LABELS, actionLabel(), ActiveBadge(), AuditList(), ConsoleTitle(), formatDateTime(), REALM_DOT, REALM_NAMES (+73 more)

### Community 42 - "email-templates.ts"
Cohesion: 0.11
Nodes (30): appPublicOrigin(), bytesToBase64(), ChapterEmailAssets, loadChapterEmailAssets(), attachImage(), mimeFromPath(), normalizeChapterLogoPath(), EmailDeliveryStatus (+22 more)

### Community 43 - "formatBRL"
Cohesion: 0.15
Nodes (28): CheckoutData, ComandaReceiptBody(), formatMoneyFromDigits(), formatMoneyFromNumber(), invalidateComanda(), mutationErrorMessage(), parsePrice(), sanitizeIntegerQty() (+20 more)

### Community 44 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, @ai-sdk/openai-compatible@^3.0.14, cmdk@^1.1.1, @dnd-kit/core@^6.3.1, @dnd-kit/utilities@^3.2.2, @hookform/resolvers@^5.2.2, lucide-react@^0.575.0, @radix-ui/react-accordion@^1.2.12 (+29 more)

### Community 45 - "auth-nav-cache.ts"
Cohesion: 0.15
Nodes (20): clearMustChangePassword, getMemberLoginGate, getMustChangePassword, applyCachedRedirects(), AuthNavCache, enterAuthenticatedApp(), fetchAuthNavGates(), runAuthenticatedBeforeLoad() (+12 more)

### Community 46 - "timezone.ts"
Cohesion: 0.12
Nodes (28): CarteirinhaDados, MyAttendancePanel(), attendanceCountLabel(), eventCountsForAttendance(), grauOf(), addressSchema, assertOwnMemberId(), buildEndereco() (+20 more)

### Community 47 - "MinutesPanel.tsx"
Cohesion: 0.16
Nodes (23): MinutesPanel(), persist(), persistDraft(), Props, STATUS_STYLE, Slider, saveMinutes, minuteKindFromLevel() (+15 more)

### Community 48 - "office-signatures.functions.ts"
Cohesion: 0.11
Nodes (27): canSignAs(), assertCanSignAsOffice(), canSignAsOffice, findMissingOfficeSignatures(), getOfficeSignaturesForChapter(), getRequiredOfficeSignature, listChapterOfficeSignatures, listMyOfficeSignatures (+19 more)

### Community 49 - "FileRoutesByPath"
Cohesion: 0.04
Nodes (50): Route, Route, Route, Route, Route, Route, Route, Route (+42 more)

### Community 50 - "atas.tsx"
Cohesion: 0.14
Nodes (27): DocTemplate, DialogDescription, createTemplate, deleteTemplate, listChapterMinutes, listDeletedChapterMinutes, listSessionsWithoutMinutes, restoreMinute (+19 more)

### Community 51 - "ChapterAuditPanel.tsx"
Cohesion: 0.17
Nodes (26): AuditLogFilterBar(), AuditLogFilterState, auditSeverityBadgeClass(), EMPTY_AUDIT_FILTERS, AREA_FILTERS, ChapterAuditPanel(), exportPdf(), matchesUser() (+18 more)

### Community 52 - "ActiveChapterContext.tsx"
Cohesion: 0.11
Nodes (23): 7. Autenticação e autorização, Autorização em duas camadas, Fluxo de autenticação, Provisão de contas (MC / Admin Total), Visibilidade por comissão, ActiveChapterContext, ActiveChapterContextValue, ActiveChapterProvider() (+15 more)

### Community 53 - "PresencasAnalytics.tsx"
Cohesion: 0.13
Nodes (27): AttendanceOverviewCache, AttendanceRec, buildRecordMap(), CalItem, CELL_LABEL, CELL_LETTER, CELL_STYLE, cellStatus (+19 more)

### Community 54 - "org-public-path.functions.ts"
Cohesion: 0.19
Nodes (15): LOBBY_SECTION, lobbyMaskSection(), PublicTokenMask(), useLobbyPublicMask(), getChapterPublicSlug, getPublicSupabase(), PUBLIC_ORG_SECTIONS, publicOrgHref() (+7 more)

### Community 55 - "finance-pdf.ts"
Cohesion: 0.09
Nodes (35): 9. Módulo Financeiro, Acoplamento mensalidade ↔ caixa, Categorias em dois níveis, Controle de acesso do módulo, Importação, exportação e relatório, Empty(), Metric(), monthName() (+27 more)

### Community 56 - "chapter-logo.ts"
Cohesion: 0.11
Nodes (27): jspdf@^4.2.1, jspdf, blobToDataUrl(), ensurePdfLogoDataUrl(), loadLogoDataUrl(), normalizeChapterLogoPath(), prepareSvgBlob(), rasterizeToPngDataUrl() (+19 more)

### Community 57 - "sidebar.tsx"
Cohesion: 0.07
Nodes (38): Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle (+30 more)

### Community 58 - "ata.$token.tsx"
Cohesion: 0.15
Nodes (24): isMinuteKind(), ensureMinutePublicShare, getMinutePublicShareToken, getPublicMinute, getPublicMinuteByMember, getPublicSupabase(), getSessionSupabase(), minuteIdInput (+16 more)

### Community 59 - "validation.ts"
Cohesion: 0.08
Nodes (31): addressSchema, affiliateMemberToChapter, createInput, guardianSchema, kindEnum, listInput, MEMBER_LIST_FIELDS, MemberKind (+23 more)

### Community 60 - "bulk-demolay-ids.ts"
Cohesion: 0.20
Nodes (7): dir, esc(), raw, rows, values, files, findTests()

### Community 61 - "membros.novo.tsx"
Cohesion: 0.19
Nodes (11): createMemberAffiliationRequest, normalizeDemolayId(), createMember, lookupMemberByDemolayId, COMMISSION_ROLES, DemolayLookupStatus, NovoMembroOdm(), PendingCommission (+3 more)

### Community 62 - "ongoing.$id.tsx"
Cohesion: 0.10
Nodes (26): useOngoingRealtime(), getOngoing, listMinutesForEvent, at(), base, turning21, CALENDAR_TYPES, CalendarTypeLabels (+18 more)

### Community 63 - "realm.ts"
Cohesion: 0.07
Nodes (48): Props, SPHERE_THEMES, SphereAuth(), SphereLoginFields, SphereTheme, AUDIENCES, FAQ, HubLanding() (+40 more)

### Community 64 - "DialogContent"
Cohesion: 0.20
Nodes (26): ChapterFormDialog(), errorText(), TempPassword(), EditSoldTicketDialog(), handleTypeChange(), mutationErrorMessage(), typePrice(), MyOfficeSignaturesPanel() (+18 more)

### Community 65 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, jobs, check, name, on, pull_request, push (+11 more)

### Community 66 - "presencas.tsx"
Cohesion: 0.14
Nodes (23): listAttendanceOverview, ATTENDANCE_TYPES, meetsVoteCadastro(), defaultPresencasFilters(), eventYear(), filtersKey(), FREQ_MONTHS, FrequencyRange (+15 more)

### Community 67 - "server.ts"
Cohesion: 0.16
Nodes (14): consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), fetch(), getServerEntry() (+6 more)

### Community 68 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 69 - "react"
Cohesion: 0.48
Nodes (5): cookieDomain(), cookieSecure(), deleteCookie(), supabaseAuthCookieStorage, writeCookie()

### Community 70 - "__root.tsx"
Cohesion: 0.15
Nodes (12): Toaster(), applyTheme(), systemPrefersDark(), THEME_STORAGE_KEY, ThemeContext, ThemeContextValue, themeInitScript, ThemeMode (+4 more)

### Community 71 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 72 - "TicketSellerRanking.tsx"
Cohesion: 0.13
Nodes (16): buildRanking(), buildSellerRankingMessage(), formatEventDay(), ordinal(), SellerBucket, SellerRankingTicket, SellerRankingTicketType, TicketSellerRanking() (+8 more)

### Community 73 - "SupademoEmbed.tsx"
Cohesion: 0.29
Nodes (10): PlaceholderShot(), Props, ScreenThumb(), shotImageSrc(), SLOT_LABEL, SupademoEmbed(), FROM_ENV, getSupademoDemoId() (+2 more)

### Community 74 - "membros.$id.tsx"
Cohesion: 0.07
Nodes (55): getMemberAttendance, commissionModuleByKey(), isFixedDemolayCommissionCode(), isAptoGrauDemolay(), resolveLinkedMemberIds(), isSameChapter(), revealMemberPii, affiliatedOrgsHeading() (+47 more)

### Community 75 - "Documentação técnica — Templo Virtual"
Cohesion: 0.10
Nodes (21): 10. Ambiente e configuração, 11. Scripts, build e deploy, 12. Estado atual e lacunas conhecidas, 13. Manutenção desta documentação, 1. Visão geral, 2. Estrutura de diretórios, 4. Convenções de arquivo (importante), 6. Modelo de dados (+13 more)

### Community 76 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 77 - "public-conference.functions.ts"
Cohesion: 0.16
Nodes (15): CalendarType, getPublicCalendar, getPublicNominata, getPublicSupabase(), PublicCalendarCategory, PublicCalendarItem, PublicCalendarPayload, PublicConferenceChapter (+7 more)

### Community 78 - "@tanstack/react-start"
Cohesion: 0.12
Nodes (19): @tanstack/react-start@^1.168.60, zod@^3.24.2, @tanstack/react-start, zod, attachSupabaseAuth, createSupabaseFetch(), isNewSupabaseApiKey(), requireSupabaseAuth (+11 more)

### Community 79 - "dues-rules.ts"
Cohesion: 0.09
Nodes (35): AttendanceReportRow, buildAttendanceReportRows(), ReportBounds, ReportItem, ReportRecord, ymd(), ChargeLike, classifyOpenChargesByMember() (+27 more)

### Community 80 - "Templo Virtual — Projeto aberto e guia de contribuição"
Cohesion: 0.13
Nodes (15): Banco de dados, Começando (setup local), Código de conduta, Licença, Modelo de `.env`, Mudanças no banco de dados, Organização do repositório, Padrões de código (+7 more)

### Community 81 - "SearchableSelect"
Cohesion: 0.32
Nodes (11): SearchableOption, SearchableSelect(), Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem (+3 more)

### Community 82 - "org-mandatory-dates.functions.ts"
Cohesion: 0.16
Nodes (17): assertDayInMonth(), dayOfYearKey(), DAYS_IN_MONTH, daysInMonth(), formatDayMonth(), listMandatoryDatesForChapter, listOrgMandatoryDates, loadMandatoryDatesForChapter() (+9 more)

### Community 83 - "presencas-xlsx.ts"
Cohesion: 0.50
Nodes (3): AttendancePdfInput, exportAttendanceXlsx(), fileSafe()

### Community 84 - "class-variance-authority"
Cohesion: 0.14
Nodes (14): class-variance-authority@^0.7.1, class-variance-authority, Alert, AlertDescription, AlertTitle, alertVariants, HoverCardContent, ScrollArea (+6 more)

### Community 85 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, build:dev, check, dev, dev:fdj, dev:hub, dev:loja (+6 more)

### Community 86 - "lucide-react"
Cohesion: 0.12
Nodes (31): formatDateTimeBR(), createOficioTemplate, deleteOficioTemplate, listOficios, saveOficioTemplate, chapterFoundedAt(), compareTerms(), currentTerm() (+23 more)

### Community 87 - "carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 88 - "cash-categories.ts"
Cohesion: 0.17
Nodes (15): cashEntryMatchesCharge(), competenceShortLabel(), duesDescription(), DYNAMIC_CATEGORIES, DynamicScope, FIXED_CATEGORIES, foldPt(), MONTH_NAMES (+7 more)

### Community 89 - "CarteirinhaProficiencia.tsx"
Cohesion: 0.24
Nodes (12): carteirinhaDialogClassName, CarteirinhaProficiencia(), classeNome(), dataCurta(), dataExtenso(), FaceFrente(), FaceVerso(), MESES (+4 more)

### Community 90 - "start.ts"
Cohesion: 0.28
Nodes (8): CONSTRAINT_MESSAGES, isControlFlowError(), RULES, SESSION_EXPIRED_MESSAGE, userFacingMessage(), ZodLikeIssue, zodMessage(), sanitizeErrorsMiddleware

### Community 91 - "index.ts"
Cohesion: 0.22
Nodes (8): b64decode(), b64encode(), EmailActionType, headerOf(), HookPayload, loadTvLogoPng(), timingSafeEqual(), verifyStandardWebhook()

### Community 92 - "ChapterSwitcher.tsx"
Cohesion: 0.16
Nodes (17): Card(), CardTitle(), Chip(), FinanceCard(), HomeShortcut, HomeView(), HomeViewProps, money() (+9 more)

### Community 93 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-slot@^1.2.4, @radix-ui/react-slot, FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext (+4 more)

### Community 94 - "perfil.tsx"
Cohesion: 0.17
Nodes (20): AccessPreview(), formatPositionHistoryLine(), PositionHistoryCollapsible(), PositionHistoryItem, COMMISSION_ROLE_LABELS, MyHistoryPanel(), Props, MyPasswordPanel() (+12 more)

### Community 95 - "ics.ts"
Cohesion: 0.21
Nodes (15): deleteCalendarItem, buildIcs(), downloadIcs(), endOrDefault(), escapeIcs(), fullLocation(), googleCalendarUrl(), IcsInviteOptions (+7 more)

### Community 96 - "inicio.tsx"
Cohesion: 0.10
Nodes (29): ChapterRow(), ChapterSwitcher(), ChapterSwitcherMenu(), SwitcherEntry, initialsOf(), listOngoingItems, useChapterLogo(), listEvents (+21 more)

### Community 97 - "Passeando pelo sistema"
Cohesion: 0.18
Nodes (11): Comissão de Eventos, Comissão de Sindicâncias, Documentação, Gestão, Hospitalaria, Início, Passeando pelo sistema, Perfil (+3 more)

### Community 98 - "vite.config.ts"
Cohesion: 0.18
Nodes (10): @tailwindcss/vite@^4.2.1, vite-tsconfig-paths@^6.0.2, nitro@3.0.260603-beta, vite@^8.0.16, @vitejs/plugin-react@^5.2.0, nitro, @tailwindcss/vite, vite (+2 more)

### Community 99 - "chave-do-dia.ts"
Cohesion: 0.17
Nodes (18): buildChaveDoDia(), buildSindicanciaChave(), CHAVE_VARIABLES, ChaveItem, chaveValues(), dateBR(), DEFAULT_CHAVE_TEMPLATE, DIAS (+10 more)

### Community 100 - "event-finance-export.test.ts"
Cohesion: 0.17
Nodes (11): buildSimpleEventIncomeLines(), ComandaReportRow, allOff, analysis, expenseLines, expenseSlices, incomeLines, rows (+3 more)

### Community 101 - "Tutorial: sua primeira contribuição"
Cohesion: 0.13
Nodes (17): 1. Fork do repositório, 2. Clone o seu fork, 3. Crie um branch, 4. Faça a alteração, 5. Adicione e faça o commit, 6. Envie o branch para o seu fork, 7. Abra o Pull Request, Antes de marcar o PR como pronto (+9 more)

### Community 102 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 103 - "Templo Virtual — Guia do Usuário"
Cohesion: 0.22
Nodes (9): Como funciona o acesso, Cuidado com os dados pessoais, Glossário, Manutenção deste guia, O que cada cargo pode fazer, O que é o Templo Virtual, Para quem é, Perguntas frequentes (+1 more)

### Community 104 - "nav.ts"
Cohesion: 0.13
Nodes (17): 5. Camada de serviço, FDJ_ALLOWED_PREFIXES, FDJ_LABELS, MOBILE_TABS, mobileOverflowGroups(), NAV_GROUPS, NavItem, NavPath (+9 more)

### Community 105 - "FdjMembers.tsx"
Cohesion: 0.10
Nodes (45): 8. PII e LGPD, AccessSection(), AccountResult, BackLink(), emptyForm, FdjMemberCreate(), FdjMemberDetail(), FdjMemberEdit() (+37 more)

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

### Community 111 - "calendar-pdf.ts"
Cohesion: 0.14
Nodes (15): CalendarCell, CalendarPdfInput, CalendarPdfItem, Doc, drawCell(), drawCheck(), exportCalendarPdf(), fileSafe() (+7 more)

### Community 112 - "navigation-menu.tsx"
Cohesion: 0.32
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 113 - "finance-pdf.ts"
Cohesion: 0.18
Nodes (16): handlePdf(), COLOR_BLACK, COLOR_GRAY, COLOR_GREEN, COLOR_RED, Entry, exportCashPdf(), exportCashSimplePdf() (+8 more)

### Community 114 - "Checklist manual — RBAC por papel (capítulo ativo)"
Cohesion: 0.33
Nodes (5): Assinaturas oficiais, Cadastro global, Checklist manual — RBAC por papel (capítulo ativo), Escopo de capítulo (multifiliação), Testes automatizados da matriz

### Community 115 - "Documentação — Templo Virtual"
Cohesion: 0.33
Nodes (6): Checklist rápido antes de abrir o PR, Discussão interna (fora do app), Documentação — Templo Virtual, Os três documentos, Qual documento atualizar, Regra de manutenção da documentação

### Community 118 - "CalendarioPage"
Cohesion: 0.24
Nodes (12): resolveTypeMeta(), addOneDayYmd(), AgendaView(), CalendarioPage(), handleExportPdf(), itemDayKeys(), ItemRow(), MandatoryDatesCard() (+4 more)

### Community 120 - "DayAgendaDialog.tsx"
Cohesion: 0.21
Nodes (16): addOneDayYmd(), CalendarAgendaView(), CalendarMonthView(), itemDayKeys(), occursOnDay(), SharedCalendarItem, toLocalDateKey(), capitalize() (+8 more)

### Community 121 - "client.server.ts"
Cohesion: 0.27
Nodes (11): MemberAccountPanel(), createSupabaseAdminClient(), createSupabaseFetch(), isNewSupabaseApiKey(), assertCanSetPasswordFor(), assertChapterAdmin(), getMemberAccountStatus, logPasswordChange() (+3 more)

### Community 122 - "minute-vars.ts"
Cohesion: 0.20
Nodes (13): abaixoDeMil(), anoPorExtenso(), buildVarMap(), CENTENAS, DEZ_A_DEZENOVE, DEZENAS, DIAS_SEMANA, MESES (+5 more)

### Community 123 - "rate-limit.server.ts"
Cohesion: 0.18
Nodes (6): supabaseAdmin, requestPasswordReset, QuotaScope, RecuperarSenhaPage(), handleSubmit(), Route

### Community 124 - "minute-kinds.ts"
Cohesion: 0.18
Nodes (11): EMPTY_MINUTE_PASSWORDS, memberCanAccessMinuteKind(), MINUTE_KIND_LABELS, MINUTE_KIND_LEVELS, MINUTE_KIND_SHORT_LABELS, MINUTE_KINDS, minuteAccessTier(), MinuteKind (+3 more)

### Community 125 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, *.md?raw

### Community 128 - "useConfirmDialog"
Cohesion: 0.36
Nodes (14): ConfirmDialogOptions, useConfirmDialog(), AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader() (+6 more)

### Community 129 - "SignaturePad"
Cohesion: 0.21
Nodes (9): checkerboardStyle, Mode, Props, SignaturePad(), capturePhoto(), clear(), startCamera(), stopCamera() (+1 more)

### Community 132 - "chapter.functions.ts"
Cohesion: 0.24
Nodes (10): MinutePasswordsCard(), PixKeyCard(), onQrFile(), removeQr(), chapterThemeSchema, getMinutePasswords, themeHex, updateChapterPixKey (+2 more)

### Community 134 - "Templo Virtual · Redesign (handoff para implementação)"
Cohesion: 0.25
Nodes (7): Mapeamento para o seletor de tema existente, Menu lateral (Sidebar.dc.html), Pendências, Regras de acessibilidade, Telas, Templo Virtual · Redesign (handoff para implementação), Tokens

### Community 135 - "MovedToConsole.tsx"
Cohesion: 0.60
Nodes (3): MovedToConsole(), Route, Route

### Community 139 - "Templo Virtual · Redesign (handoff para implementação)"
Cohesion: 0.33
Nodes (5): Pendências, Regras de acessibilidade, Telas, Templo Virtual · Redesign (handoff para implementação), Tokens

### Community 143 - "3. Arquitetura e fluxo de dados"
Cohesion: 0.40
Nodes (5): 3. Arquitetura e fluxo de dados, Camadas, Caminho completo de uma requisição, Exceções ao caminho acima, Pontos de entrada

### Community 146 - "ConsoleLogin"
Cohesion: 0.50
Nodes (3): ConsoleLogin(), onPassword(), resolveStep()

### Community 159 - "SelectItem"
Cohesion: 0.23
Nodes (18): DUE_STATUS_LABEL, MyFinancePanel(), DUE_STATUS_LABEL, LobbyMemberPortalPage(), MemberCadastroTab(), MemberChargesTab(), Card, Progress (+10 more)

### Community 163 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 164 - "storageKey"
Cohesion: 0.67
Nodes (3): logout(), resetAccess(), storageKey()

## Knowledge Gaps
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Button` to `useConfirmDialog`, `SignaturePad`, `cn`, `MinuteBodyEditor.tsx`, `formatDateBR`, `regional.calendario.tsx`, `sonner`, `SindicanciaAtaForm.tsx`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `eventos.$id.tsx`, `AppShell.tsx`, `Label`, `sindicancias.fichas.tsx`, `membros.index.tsx`, `docs-catalog.ts`, `eventos.checkins.tsx`, `package.json`, `tesouraria.fluxo.tsx`, `format.ts`, `org-join-request.functions.ts`, `@tanstack/react-router`, `configuracoes.tsx`, `SelectItem`, `permissions.ts`, `tesouraria.mensalidades.tsx`, `ThemeToggle`, `chart.tsx`, `position-catalog.functions.ts`, `Card`, `tesouraria.cobrancas.tsx`, `instituicoes.$id.tsx`, `formatBRL`, `dependencies`, `auth-nav-cache.ts`, `timezone.ts`, `MinutesPanel.tsx`, `office-signatures.functions.ts`, `atas.tsx`, `ChapterAuditPanel.tsx`, `ActiveChapterContext.tsx`, `PresencasAnalytics.tsx`, `finance-pdf.ts`, `chapter-logo.ts`, `sidebar.tsx`, `ata.$token.tsx`, `membros.novo.tsx`, `ongoing.$id.tsx`, `realm.ts`, `DialogContent`, `presencas.tsx`, `__root.tsx`, `TicketSellerRanking.tsx`, `SupademoEmbed.tsx`, `membros.$id.tsx`, `menubar.tsx`, `SearchableSelect`, `class-variance-authority`, `lucide-react`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `ChapterSwitcher.tsx`, `form.tsx`, `perfil.tsx`, `inicio.tsx`, `pagination.tsx`, `nav.ts`, `FdjMembers.tsx`, `navigation-menu.tsx`, `DayAgendaDialog.tsx`, `rate-limit.server.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Should `regional.calendario.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14717741935483872 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `cn` to `useConfirmDialog`, `SignaturePad`, `regional.calendario.tsx`, `MinuteBodyEditor.tsx`, `formatDateBR`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `eventos.$id.tsx`, `AppShell.tsx`, `Label`, `sindicancias.fichas.tsx`, `docs-catalog.ts`, `Button`, `tesouraria.fluxo.tsx`, `configuracoes.tsx`, `SelectItem`, `tesouraria.mensalidades.tsx`, `Card`, `position-catalog.functions.ts`, `chart.tsx`, `formatBRL`, `MinutesPanel.tsx`, `atas.tsx`, `ChapterAuditPanel.tsx`, `sidebar.tsx`, `realm.ts`, `DialogContent`, `TicketSellerRanking.tsx`, `SupademoEmbed.tsx`, `menubar.tsx`, `SearchableSelect`, `class-variance-authority`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `ChapterSwitcher.tsx`, `form.tsx`, `perfil.tsx`, `inicio.tsx`, `pagination.tsx`, `navigation-menu.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.01679328268692523 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `Button` to `useConfirmDialog`, `SignaturePad`, `cn`, `regional.calendario.tsx`, `formatDateBR`, `chapter.functions.ts`, `sonner`, `MovedToConsole.tsx`, `SindicanciaAtaForm.tsx`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `investigations.functions.ts`, `eventos.$id.tsx`, `AppShell.tsx`, `membros.solicitacoes.tsx`, `Label`, `sindicancias.fichas.tsx`, `ConsoleLogin`, `membros.index.tsx`, `docs-catalog.ts`, `finance.functions.ts`, `eventos.checkins.tsx`, `event-finance.functions.ts`, `tesouraria.fluxo.tsx`, `format.ts`, `@tanstack/react-router`, `configuracoes.tsx`, `SelectItem`, `permissions.ts`, `tesouraria.cobrancas.tsx`, `ThemeToggle`, `Card`, `position-catalog.functions.ts`, `atualizar-cadastro.tsx`, `tesouraria.mensalidades.tsx`, `Atrasados`, `instituicoes.$id.tsx`, `formatBRL`, `MinutesPanel.tsx`, `atas.tsx`, `ChapterAuditPanel.tsx`, `finance-pdf.ts`, `sidebar.tsx`, `ata.$token.tsx`, `membros.novo.tsx`, `ongoing.$id.tsx`, `DialogContent`, `presencas.tsx`, `TicketSellerRanking.tsx`, `membros.$id.tsx`, `SearchableSelect`, `lucide-react`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `ChapterSwitcher.tsx`, `perfil.tsx`, `ics.ts`, `FdjMembers.tsx`, `sugestoes.tsx`, `CalendarioPage`, `DayAgendaDialog.tsx`, `client.server.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.053410893707033315 - nodes in this community are weakly interconnected._
- **Should `MinuteBodyEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12962962962962962 - nodes in this community are weakly interconnected._