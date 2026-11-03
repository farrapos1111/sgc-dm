# Graph Report - sgc-dm  (2026-11-03)

## Corpus Check
- 552 files · ~455,464 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 5, .css 3, .example 2)

## Summary
- 3458 nodes · 12463 edges · 161 communities (124 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 124 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e471c31c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- membros.$id.tsx
- routeTree.gen.ts
- cn
- MinuteBodyEditor.tsx
- Button
- event-finance-export.ts
- PageHeader
- @tanstack/react-start
- SindicanciaAtaForm.tsx
- calendario.tsx
- sindicancias.sindicarias.tsx
- investigations.functions.ts
- eventos.$id.tsx
- AppShell.tsx
- FileRoutesByPath
- SelectContent
- events.functions.ts
- sindicancias.fichas.tsx
- accounts.functions.ts
- Badge
- docs-catalog.ts
- finance.functions.ts
- atas.tsx
- event-finance.functions.ts
- dependencies
- regional.calendario.tsx
- tesouraria.fluxo.tsx
- MemberFields.tsx
- org-join-request.functions.ts
- @tanstack/react-router
- useActiveChapter
- permissions.ts
- tesouraria.cobrancas.tsx
- tesouraria.mensalidades.tsx
- configuracoes.tsx
- org.functions.ts
- configuracoes-globais.cargos.tsx
- screen-access.ts
- audit-log.ts
- Atrasados
- devDependencies
- utils.ts
- email-templates.ts
- formatBRL
- package.json
- auth-nav-cache.ts
- timezone.ts
- MinutesPanel.tsx
- office-signatures.functions.ts
- members.functions.ts
- member-documents.ts
- ChapterAuditPanel.tsx
- ActiveChapterContext.tsx
- PresencasAnalytics.tsx
- regional.membros.tsx
- finance-pdf.ts
- regional.aparencia.tsx
- lobby-share.functions.ts
- ata.$token.tsx
- validation.ts
- bulk-demolay-ids.ts
- format.ts
- calendar-types.ts
- realm.ts
- platform-access.functions.ts
- steps
- presencas.tsx
- server.ts
- components.json
- react
- __root.tsx
- compilerOptions
- TicketSellerRanking.tsx
- HubLanding.tsx
- ongoing.$id.tsx
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
- ThemeToggle
- carousel.tsx
- cash-categories.ts
- CarteirinhaProficiencia.tsx
- start.ts
- index.ts
- SupademoEmbed.tsx
- form.tsx
- fixed-commissions.ts
- ics.ts
- minute-kinds.ts
- Passeando pelo sistema
- vite.config.ts
- chart.tsx
- permissions.test.ts
- Tutorial: sua primeira contribuição
- pagination.tsx
- Templo Virtual — Guia do Usuário
- 6. Modelo de dados
- MyCadastroPanel.tsx
- sugestoes.tsx
- Futuro — filiações multi-corpo (discussão)
- OPEN-SOURCE.md
- updates
- Templo Virtual — Hub de gerenciamento das ordens paramaçônicas
- drawer.tsx
- navigation-menu.tsx
- permissions-sql-parity.test.ts
- Checklist manual — RBAC por papel (capítulo ativo)
- Documentação — Templo Virtual
- gen-favicon.mjs
- commissions.functions.ts
- sphere-members.functions.ts
- QrScanner.tsx
- input-otp.tsx
- router.tsx
- documentacao/index.tsx
- minute-pdf.ts
- oficio-signatures.ts
- vite-env.d.ts
- @radix-ui/react-aspect-ratio
- .prettierrc.json
- calendar.tsx
- documentacao/route.tsx
- Routes
- AGENTS.md
- @dnd-kit/core
- @dnd-kit/sortable
- @dnd-kit/utilities
- @hookform/resolvers@^5.2.2
- input-otp
- qrcode
- @radix-ui/react-avatar
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-menubar
- @radix-ui/react-progress
- @radix-ui/react-scroll-area
- @radix-ui/react-slider
- @radix-ui/react-switch
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react-hook-form
- react-markdown
- react-resizable-panels
- tailwind-merge
- vaul
- xlsx
- financeiro.tsx
- regional.estados.tsx
- sindicancias.processos.tsx
- $org.frequencia.tsx
- $org.perfil.tsx
- Route

## God Nodes (most connected - your core abstractions)
1. `cn()` - 278 edges
2. `Button` - 212 edges
3. `Card` - 179 edges
4. `react` - 167 edges
5. `Input` - 125 edges
6. `lucide-react` - 123 edges
7. `Label` - 110 edges
8. `@tanstack/react-router` - 96 edges
9. `useActiveChapter()` - 94 edges
10. `SelectContent` - 93 edges

## Surprising Connections (you probably didn't know these)
- `3. Crie um branch` --references--> `main()`  [INFERRED]
  docs/OPEN-SOURCE.md → scripts/bulk-demolay-ids.ts
- `Histórico git` --references--> `main()`  [INFERRED]
  docs/OPEN-SOURCE.md → scripts/bulk-demolay-ids.ts
- `Camadas` --references--> `AppShell()`  [INFERRED]
  docs/TECNICO.md → src/components/shell/AppShell.tsx
- `Acoplamento mensalidade ↔ caixa` --references--> `duesDescription()`  [INFERRED]
  docs/TECNICO.md → src/lib/cash-categories.ts
- `Categorias em dois níveis` --references--> `resolveSubcategory()`  [INFERRED]
  docs/TECNICO.md → src/lib/cash-validation.server.ts

## Import Cycles
- None detected.

## Communities (161 total, 37 thin omitted)

### Community 0 - "membros.$id.tsx"
Cohesion: 0.05
Nodes (84): formatPositionHistoryLine(), PositionHistoryCollapsible(), PositionHistoryItem, COMMISSION_ROLE_LABELS, Props, SEMESTER_LABELS, getMemberAttendance, isFixedDemolayCommissionCode() (+76 more)

### Community 1 - "routeTree.gen.ts"
Cohesion: 0.02
Nodes (99): AtaTokenRoute, AtualizarCadastroRoute, AuthAdicionarOrganizacaoRoute, AuthAssinaturaRoute, AuthenticatedRouteRoute, AuthenticatedRouteRouteChildren, AuthenticatedRouteRouteWithChildren, AuthenticatedSelecionarCapituloRoute (+91 more)

### Community 2 - "cn"
Cohesion: 0.04
Nodes (74): Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList (+66 more)

### Community 3 - "MinuteBodyEditor.tsx"
Cohesion: 0.05
Nodes (65): ActiveSuggest, assignRef(), BalloonPos, getCaretOffsetInTextarea(), MinuteBodyEditor(), acceptMention(), acceptVar(), onKeyDown() (+57 more)

### Community 4 - "Button"
Cohesion: 0.09
Nodes (50): lucide-react, sonner, @tanstack/react-query, countVars(), previewSnippet(), Props, TemplateEditorCard(), AccessPreview() (+42 more)

### Community 5 - "event-finance-export.ts"
Cohesion: 0.06
Nodes (69): budgetExpenseShortName(), buildEventReportAnalysis(), buildSimpleEventExpenseLines(), buildSimpleEventIncomeLines(), CASH_COL_WEIGHT, cashCellText(), COLOR_AMBER, COLOR_BLACK (+61 more)

### Community 6 - "PageHeader"
Cohesion: 0.08
Nodes (56): readAutocompletePref(), writeAutocompletePref(), DraftProps, OficioDocumentHeader(), OficioDraftPanel(), OficioSignatures(), OficioViewPanel(), ViewProps (+48 more)

### Community 7 - "@tanstack/react-start"
Cohesion: 0.05
Nodes (57): @tanstack/react-start@^1.168.60, zod@^3.24.2, @supabase/supabase-js, @tanstack/react-start, zod, createSupabaseFetch(), isNewSupabaseApiKey(), requireSupabaseAuth (+49 more)

### Community 8 - "SindicanciaAtaForm.tsx"
Cohesion: 0.07
Nodes (52): checkerboardStyle, Mode, Props, SignaturePad(), capturePhoto(), clear(), startCamera(), stopCamera() (+44 more)

### Community 9 - "calendario.tsx"
Cohesion: 0.09
Nodes (48): AccordionContent, AccordionItem, AccordionTrigger, useIsMobile(), assertMandatoryDateForChapter(), calendarTypeEnum, ChapterCalendarCategory, createCalendarItem (+40 more)

### Community 10 - "sindicancias.sindicarias.tsx"
Cohesion: 0.06
Nodes (44): kindLabel(), MemberLite, MemberSearchSelect(), Props, AtaFormMode, SheetFooter(), Textarea, CommissionAccess (+36 more)

### Community 11 - "investigations.functions.ts"
Cohesion: 0.05
Nodes (53): addressSchema, ALLOWED_IMAGE_MIMES, asAnswerMap(), asBlocks(), asSignatureMap(), buildFilePayload(), chapterInput, createFile (+45 more)

### Community 12 - "eventos.$id.tsx"
Cohesion: 0.09
Nodes (45): ConfirmDialogOptions, useConfirmDialog(), AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader() (+37 more)

### Community 13 - "AppShell.tsx"
Cohesion: 0.08
Nodes (39): 5. Camada de serviço, Visibilidade por comissão, DelayedPageSkeleton(), DelayedSuspenseFallback(), AppShell(), ChapterMark(), PRELOAD_ROUTES, SidebarClock() (+31 more)

### Community 14 - "FileRoutesByPath"
Cohesion: 0.04
Nodes (53): Route, Route, Route, Route, Route, Route, Route, Route (+45 more)

### Community 15 - "SelectContent"
Cohesion: 0.09
Nodes (40): EditableTicket, EditSoldTicketDialog(), handleTypeChange(), mutationErrorMessage(), TicketType, typePrice(), PresencasChartsTab(), TermSelect() (+32 more)

### Community 16 - "events.functions.ts"
Cohesion: 0.09
Nodes (39): TicketPass(), TicketPassProps, EmailDeliveryStatus, SendEmailResult, summarizeEmailResult(), addDaysYmd(), assertEventFinanceOpen(), effectiveEventFinanceCloseYmd() (+31 more)

### Community 17 - "sindicancias.fichas.tsx"
Cohesion: 0.10
Nodes (41): DocPathsState, DocPreviewState, emptyDocPaths(), Props, readFilePreview(), validateDocFile(), emptyInvestigationFile(), InvestigationFileFormValue (+33 more)

### Community 18 - "accounts.functions.ts"
Cohesion: 0.10
Nodes (43): createSupabaseAdminClient(), createSupabaseFetch(), isNewSupabaseApiKey(), accessSummaryFrom(), AdminClient, assertCanManageMemberAccounts(), assertCanSetPasswordFor(), assertChapterAdmin() (+35 more)

### Community 19 - "Badge"
Cohesion: 0.09
Nodes (38): DUE_STATUS_LABEL, MyFinancePanel(), MyHistoryPanel(), Badge(), BadgeProps, badgeVariants, Progress, autoDueExemptTip() (+30 more)

### Community 20 - "docs-catalog.ts"
Cohesion: 0.10
Nodes (34): DocsLayout(), DocsLayoutProps, flattenText(), Heading(), MarkdownDoc(), MarkdownDocProps, PageToc(), SheetContent (+26 more)

### Community 21 - "finance.functions.ts"
Cohesion: 0.10
Nodes (43): AwayPeriod, getChapterDefaultDuesAmount(), memberInYearTable(), adjustTrackedStock(), aggregateCashAmounts(), applyAutoStatusesForOpenDues(), CashAggRow, cashEffectiveUntilExclusive() (+35 more)

### Community 22 - "atas.tsx"
Cohesion: 0.09
Nodes (35): DocTemplate, DocumentTemplatesPanel(), EmptyState(), UnderConstruction(), useEventCheckinRealtime(), listChapterTicketsForCheckin, createTemplate, deleteTemplate (+27 more)

### Community 23 - "event-finance.functions.ts"
Cohesion: 0.11
Nodes (34): budgetExpenseName(), EventFinancePanel(), formatDateLabel(), mutationErrorMessage(), buildComandaReportRows(), addEventBudgetExpense, assertBudgetCashEntry(), BUDGET_CATEGORY_NAME (+26 more)

### Community 24 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, ai@^7.0.37, clsx@^2.1.1, embla-carousel-react@^8.6.0, lucide-react@^0.575.0, @radix-ui/react-checkbox@^1.3.3, @radix-ui/react-collapsible@^1.1.12, @radix-ui/react-context-menu@^2.2.16 (+31 more)

### Community 25 - "regional.calendario.tsx"
Cohesion: 0.14
Nodes (32): addOneDayYmd(), CalendarAgendaView(), CalendarMonthView(), itemDayKeys(), occursOnDay(), SharedCalendarItem, toLocalDateKey(), capitalize() (+24 more)

### Community 26 - "tesouraria.fluxo.tsx"
Cohesion: 0.08
Nodes (30): SelectLabel, competenceShortLabel(), duesDescription(), ensureCashShareToken, getCashShareToken, revokeCashShareToken, createManualDuesEntry, deleteCashCategory (+22 more)

### Community 27 - "MemberFields.tsx"
Cohesion: 0.15
Nodes (32): DocumentUploadFields(), InvestigationAddress, InvestigationFileForm(), doLookupCep(), MemberOption, SectionHeading(), ChapterOption, emptyGuardian (+24 more)

### Community 28 - "org-join-request.functions.ts"
Cohesion: 0.10
Nodes (35): isMissingAuthLoginThrottleTable(), ACTIVE_MEMBERS_BANDS, ActiveMembersBand, AnyClient, assertAdminTotal(), assertOrgJoinNotThrottled(), buildEmailBody(), digitsOnlyPhone() (+27 more)

### Community 29 - "@tanstack/react-router"
Cohesion: 0.12
Nodes (27): @tanstack/react-router, LOBBY_SECTION, lobbyMaskSection(), PublicTokenMask(), useLobbyPublicMask(), LobbyBackLink(), PublicLobbyContextValue, usePublicLobby() (+19 more)

### Community 30 - "useActiveChapter"
Cohesion: 0.12
Nodes (27): PageSkeleton(), useActiveChapter(), useChapterAccess(), formatChapterIdentity(), listEvents, formatDateTimeBR(), parseDateOnly(), listOpenSindicanciasForMe (+19 more)

### Community 31 - "permissions.ts"
Cohesion: 0.11
Nodes (33): Autorização em duas camadas, ActionPermission, can(), canAccess(), canAction(), canBrowseAllScreens(), canManageAttendance(), canManageAttendanceAccess() (+25 more)

### Community 32 - "tesouraria.cobrancas.tsx"
Cohesion: 0.10
Nodes (28): chargeCashDescription(), memberChargeAmountSchema, parseChargeAmount(), addChargePayment, deleteChargePayment, deleteMemberCharge, findReusableChargeCashEntry(), listCashCategories (+20 more)

### Community 33 - "tesouraria.mensalidades.tsx"
Cohesion: 0.10
Nodes (27): competenceLabel(), classifyOpenMonthsForMember(), isDueOverdue(), isFutureMonth(), ensureDuesShareToken, getDuesShareToken, revokeDuesShareToken, bulkYearDuesAction (+19 more)

### Community 34 - "configuracoes.tsx"
Cohesion: 0.11
Nodes (27): chapterThemeSchema, deleteLodge, saveLodge, themeHex, updateChapterAccentColor, updateChapterProfile, ChapterTheme, CORE_THEME_KEYS (+19 more)

### Community 35 - "org.functions.ts"
Cohesion: 0.11
Nodes (31): assertCanManageOrg(), deleteRegion, deleteState, listOrgLeaderships, listRegions, listScopeChapters, listStates, lookupRegionMemberByDemolay (+23 more)

### Community 36 - "configuracoes-globais.cargos.tsx"
Cohesion: 0.11
Nodes (30): BillingModel, isOrgType(), ORG_TYPE_FILTER_LABELS, ORG_TYPES, ORG_TYPES_FLAT, ORG_TYPES_UI, ORG_TYPES_WITH_ROLE_GROUPS, OrgType (+22 more)

### Community 37 - "screen-access.ts"
Cohesion: 0.11
Nodes (33): ACCOUNT_ROLE_TO_KEYS, ALL_CHAPTER_SCREENS, AUDITORIA, commissionScreensForCode(), cru(), crud(), emptyGrantFlags(), ENTRETENIMENTO (+25 more)

### Community 38 - "audit-log.ts"
Cohesion: 0.10
Nodes (31): assertCanViewChapterAudit(), asString(), ChapterAuditRow, listChapterAudit, payloadUuid(), withComandaNames(), ymdRangeIso(), asNumber() (+23 more)

### Community 39 - "Atrasados"
Cohesion: 0.09
Nodes (29): buildOverdueReportMessage(), buildReminderMessage(), buildWhatsAppUrl(), ChargeLike, classifyOpenChargesByMember(), classifyOverdueChargesByMember(), DueLike, firstNameFromFullName() (+21 more)

### Community 40 - "devDependencies"
Cohesion: 0.07
Nodes (31): devDependencies, eslint@^9.32.0, eslint-config-prettier@^10.1.1, @eslint/js@^9.32.0, eslint-plugin-prettier@^5.2.6, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.20, globals@^15.15.0 (+23 more)

### Community 41 - "utils.ts"
Cohesion: 0.12
Nodes (25): CashColumnsPicker(), EventFinanceReportDialog(), generate(), formatDateLabel(), gestaoFromEventDate(), SortableReportBlockRow(), Checkbox, Switch (+17 more)

### Community 42 - "email-templates.ts"
Cohesion: 0.12
Nodes (28): appPublicOrigin(), bytesToBase64(), ChapterEmailAssets, loadChapterEmailAssets(), attachImage(), mimeFromPath(), normalizeChapterLogoPath(), envPublicOrigin() (+20 more)

### Community 43 - "formatBRL"
Cohesion: 0.14
Nodes (30): CheckoutData, ComandaReceiptBody(), formatMoneyFromDigits(), formatMoneyFromNumber(), invalidateComanda(), mutationErrorMessage(), parsePrice(), sanitizeIntegerQty() (+22 more)

### Community 44 - "package.json"
Cohesion: 0.07
Nodes (29): @ai-sdk/openai-compatible@^3.0.14, cmdk@^1.1.1, date-fns@^4.1.0, jspdf@^4.2.1, @radix-ui/react-accordion@^1.2.12, @radix-ui/react-alert-dialog@^1.1.15, @radix-ui/react-navigation-menu@^1.2.14, @radix-ui/react-tabs@^1.1.13 (+21 more)

### Community 45 - "auth-nav-cache.ts"
Cohesion: 0.16
Nodes (22): handleSignOut(), clearMustChangePassword, getMemberLoginGate, getMustChangePassword, applyCachedRedirects(), AuthNavCache, clearAuthNavCache(), enterAuthenticatedApp() (+14 more)

### Community 46 - "timezone.ts"
Cohesion: 0.12
Nodes (27): addressSchema, assertOwnMemberId(), buildEndereco(), ChapterJoin, findLinkedMemberIds(), getMyDemolayProfile, getMyMemberAttendance, getMyMemberCadastro (+19 more)

### Community 47 - "MinutesPanel.tsx"
Cohesion: 0.15
Nodes (24): MinutesPanel(), persist(), persistDraft(), Props, STATUS_STYLE, Slider, saveMinutes, minuteKindFromLevel() (+16 more)

### Community 48 - "office-signatures.functions.ts"
Cohesion: 0.14
Nodes (23): canSignAs(), assertCanSignAsOffice(), canSignAsOffice, findMissingOfficeSignatures(), getOfficeSignaturesForChapter(), getRequiredOfficeSignature, listChapterOfficeSignatures, MyOfficeSignatureRow (+15 more)

### Community 49 - "members.functions.ts"
Cohesion: 0.10
Nodes (23): resolveLinkedMemberIds(), normalizeDemolayId(), addressSchema, affiliateMemberToChapter, createInput, createMember, guardianSchema, kindEnum (+15 more)

### Community 50 - "member-documents.ts"
Cohesion: 0.11
Nodes (22): AgeBand, AtaBlock, AtaBlockType, AtaTemplate, AtaTemplates, docColumnForKind(), EMPTY_ATA_TEMPLATES, ID_DOC_KINDS (+14 more)

### Community 51 - "ChapterAuditPanel.tsx"
Cohesion: 0.17
Nodes (24): AuditLogFilterBar(), AuditLogFilterState, auditSeverityBadgeClass(), EMPTY_AUDIT_FILTERS, AREA_FILTERS, ChapterAuditPanel(), exportPdf(), matchesUser() (+16 more)

### Community 52 - "ActiveChapterContext.tsx"
Cohesion: 0.12
Nodes (22): 7. Autenticação e autorização, Fluxo de autenticação, Provisão de contas (MC / Admin Total), ActiveChapterContext, ActiveChapterContextValue, ActiveChapterProvider(), Membership, pickPreferredMembership() (+14 more)

### Community 53 - "PresencasAnalytics.tsx"
Cohesion: 0.12
Nodes (23): AttendanceOverviewCache, AttendanceRec, buildRecordMap(), byTypeConfig, CalItem, CELL_LABEL, CELL_LETTER, CELL_STYLE (+15 more)

### Community 54 - "regional.membros.tsx"
Cohesion: 0.18
Nodes (17): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, createScopeMember, listScopeMembers, setScopeMemberStatus (+9 more)

### Community 55 - "finance-pdf.ts"
Cohesion: 0.13
Nodes (22): CashTotals, cashTotalsFromCents(), centsToMoney(), moneyCents(), roundCashTotals(), sumCashByKind(), rounded, summed (+14 more)

### Community 56 - "regional.aparencia.tsx"
Cohesion: 0.16
Nodes (19): ChapterLogoAvatar(), blobToDataUrl(), ensurePdfLogoDataUrl(), loadLogoDataUrl(), LOGO_BUCKET, normalizeChapterLogoPath(), prepareSvgBlob(), rasterizeToPngDataUrl() (+11 more)

### Community 57 - "lobby-share.functions.ts"
Cohesion: 0.12
Nodes (21): publicSenderKey(), chapterInput, ensurePublicLobbyToken, getPublicAttendance, getPublicLobby, getPublicLobbyToken, getPublicMemberPortal, getPublicSupabase() (+13 more)

### Community 58 - "ata.$token.tsx"
Cohesion: 0.17
Nodes (22): isMinuteKind(), getMinutePublicShareToken, getPublicMinute, getPublicMinuteByMember, getPublicSupabase(), minuteIdInput, minutePublicShareStorageKey(), MinutePublicVote (+14 more)

### Community 59 - "validation.ts"
Cohesion: 0.14
Nodes (18): hasCents(), isPlausibleBirthDate(), isValidCpf(), isValidPhone(), isValidYmd(), MAX_MONEY, onlyDigits(), optionalBirthDate (+10 more)

### Community 60 - "bulk-demolay-ids.ts"
Cohesion: 0.13
Nodes (14): APPLY, LIST_FILE, loadEnvLocal(), main(), normalizeName(), parseList(), SCRIPT_DIR, dir (+6 more)

### Community 61 - "format.ts"
Cohesion: 0.16
Nodes (18): MemberFormData, MemberKind, MemberStatus, ageFrom(), is21OrOlder(), isMinor(), isUnder21(), KIND_LABELS (+10 more)

### Community 62 - "calendar-types.ts"
Cohesion: 0.19
Nodes (17): at(), base, turning21, attendanceCountLabel(), CalendarType, eventCountsForAttendance(), NO_MINUTES_TYPES, SESSION_TYPES (+9 more)

### Community 63 - "realm.ts"
Cohesion: 0.20
Nodes (17): ORG_TYPE_LABELS, apexFromHostname(), getDevRealmOverride(), getRealmForOrgType(), hostnameWithoutPort(), isHubHost(), isLocalApexHostname(), isRealm() (+9 more)

### Community 64 - "platform-access.functions.ts"
Cohesion: 0.19
Nodes (20): orgTypeHasRoleGroups(), adminDb(), AnyClient, assertAdminTotal(), deletePlatformAccessRole, grantRowSchema, linkPlatformAccessRoleToPosition, listPlatformAccessMatrix (+12 more)

### Community 65 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, jobs, check, name, on, pull_request, push (+11 more)

### Community 66 - "presencas.tsx"
Cohesion: 0.14
Nodes (19): listAttendanceOverview, ATTENDANCE_TYPES, meetsVoteCadastro(), defaultPresencasFilters(), eventYear(), filtersKey(), FREQ_MONTHS, FrequencyRange (+11 more)

### Community 67 - "server.ts"
Cohesion: 0.16
Nodes (15): consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), APP_TIMEZONE, fetch() (+7 more)

### Community 68 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 69 - "react"
Cohesion: 0.20
Nodes (11): react, QUERY_KEY, createSupabaseClient(), createSupabaseFetch(), isNewSupabaseApiKey(), supabase, cookieDomain(), cookieSecure() (+3 more)

### Community 70 - "__root.tsx"
Cohesion: 0.16
Nodes (12): Toaster(), ToasterProps, applyTheme(), systemPrefersDark(), THEME_STORAGE_KEY, ThemeContext, ThemeContextValue, themeInitScript (+4 more)

### Community 71 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 72 - "TicketSellerRanking.tsx"
Cohesion: 0.16
Nodes (11): DocsSidebar(), DocsSidebarProps, SidebarGroup(), buildRanking(), buildSellerRankingMessage(), formatEventDay(), ordinal(), SellerBucket (+3 more)

### Community 73 - "HubLanding.tsx"
Cohesion: 0.16
Nodes (13): AUDIENCES, FAQ, HubLanding(), MODULES, NAV_LINKS, PageHead(), useReveal(), useHubHostGuard() (+5 more)

### Community 74 - "ongoing.$id.tsx"
Cohesion: 0.20
Nodes (15): useOngoingRealtime(), getOngoing, listMinutesForEvent, listOngoingItems, setAttendance, supportsMinutes(), Counter(), minuteTabLabel() (+7 more)

### Community 75 - "Documentação técnica — Templo Virtual"
Cohesion: 0.12
Nodes (17): 10. Ambiente e configuração, 11. Scripts, build e deploy, 12. Estado atual e lacunas conhecidas, 13. Manutenção desta documentação, 1. Visão geral, 2. Estrutura de diretórios, 3. Arquitetura e fluxo de dados, 4. Convenções de arquivo (importante) (+9 more)

### Community 76 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 77 - "public-conference.functions.ts"
Cohesion: 0.15
Nodes (16): CalendarTypeLabels, PrazoKind, getPublicCalendar, getPublicNominata, getPublicSupabase(), PublicCalendarCategory, PublicCalendarItem, PublicCalendarPayload (+8 more)

### Community 78 - "rate-limit.server.ts"
Cohesion: 0.18
Nodes (6): supabaseAdmin, assertAiQuota(), composeEventDescription, improveText, requireAiKey(), QuotaScope

### Community 79 - "dues-rules.ts"
Cohesion: 0.26
Nodes (15): CellStatus, autoDueExemptKind(), autoDueStatus(), AutoExemptKind, cmpYm(), cmpYmd(), DEFAULT_DUES_AMOUNT, DUES_ONLY_NAV_PATHS (+7 more)

### Community 80 - "Templo Virtual — Projeto aberto e guia de contribuição"
Cohesion: 0.13
Nodes (15): Banco de dados, Começando (setup local), Código de conduta, Licença, Modelo de `.env`, Mudanças no banco de dados, Organização do repositório, Padrões de código (+7 more)

### Community 81 - "SearchableSelect"
Cohesion: 0.28
Nodes (12): SearchableOption, SearchableSelect(), Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem (+4 more)

### Community 82 - "org-mandatory-dates.functions.ts"
Cohesion: 0.17
Nodes (14): assertDayInMonth(), dayOfYearKey(), DAYS_IN_MONTH, daysInMonth(), formatDayMonth(), loadMandatoryDatesForChapter(), mandatoryDateSortKey(), MONTH_NAMES (+6 more)

### Community 83 - "finance-xlsx.ts"
Cohesion: 0.19
Nodes (13): 9. Módulo Financeiro, Acoplamento mensalidade ↔ caixa, Categorias em dois níveis, Controle de acesso do módulo, Importação, exportação e relatório, downloadCashTemplate(), parseCashSheet(), ParsedRow (+5 more)

### Community 84 - "class-variance-authority"
Cohesion: 0.20
Nodes (11): class-variance-authority@^0.7.1, class-variance-authority, Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext (+3 more)

### Community 85 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, build:dev, check, dev, dev:fdj, dev:hub, dev:loja (+6 more)

### Community 86 - "ThemeToggle"
Cohesion: 0.33
Nodes (10): ThemeToggle(), PublicLobbyContext, applyChapterThemeVars(), applyPlatformDefaultThemeVars(), resolveChapterTheme(), AuthLayout(), Route, PublicLobbyLayout() (+2 more)

### Community 87 - "carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 88 - "cash-categories.ts"
Cohesion: 0.20
Nodes (12): cashEntryMatchesCharge(), DYNAMIC_CATEGORIES, DynamicScope, FIXED_CATEGORIES, foldPt(), MONTH_NAMES, SCOPE_LABELS, scopeOfCategory() (+4 more)

### Community 89 - "CarteirinhaProficiencia.tsx"
Cohesion: 0.24
Nodes (10): classeNome(), dataCurta(), dataExtenso(), FaceFrente(), FaceVerso(), MESES, Props, Selo() (+2 more)

### Community 90 - "start.ts"
Cohesion: 0.23
Nodes (10): attachSupabaseAuth, CONSTRAINT_MESSAGES, isControlFlowError(), RULES, SESSION_EXPIRED_MESSAGE, userFacingMessage(), ZodLikeIssue, zodMessage() (+2 more)

### Community 91 - "index.ts"
Cohesion: 0.22
Nodes (8): b64decode(), b64encode(), EmailActionType, headerOf(), HookPayload, loadTvLogoPng(), timingSafeEqual(), verifyStandardWebhook()

### Community 92 - "SupademoEmbed.tsx"
Cohesion: 0.29
Nodes (10): PlaceholderShot(), Props, ScreenThumb(), shotImageSrc(), SLOT_LABEL, SupademoEmbed(), FROM_ENV, getSupademoDemoId() (+2 more)

### Community 93 - "form.tsx"
Cohesion: 0.23
Nodes (10): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+2 more)

### Community 94 - "fixed-commissions.ts"
Cohesion: 0.18
Nodes (10): COMMISSION_MODULE_KEYS, COMMISSION_MODULES, CommissionModule, commissionModuleByKey(), CommissionModuleKey, effectiveCommissionModuleKey(), FIXED_DEMOLAY_COMMISSION_CODES, FIXED_DEMOLAY_COMMISSIONS (+2 more)

### Community 95 - "ics.ts"
Cohesion: 0.33
Nodes (11): buildIcs(), downloadIcs(), endOrDefault(), escapeIcs(), fullLocation(), googleCalendarUrl(), IcsInviteOptions, IcsItem (+3 more)

### Community 96 - "minute-kinds.ts"
Cohesion: 0.18
Nodes (11): EMPTY_MINUTE_PASSWORDS, memberCanAccessMinuteKind(), MINUTE_KIND_LABELS, MINUTE_KIND_LEVELS, MINUTE_KIND_SHORT_LABELS, MINUTE_KINDS, minuteAccessTier(), MinuteKind (+3 more)

### Community 97 - "Passeando pelo sistema"
Cohesion: 0.18
Nodes (11): Comissão de Eventos, Comissão de Sindicâncias, Documentação, Gestão, Hospitalaria, Início, Passeando pelo sistema, Perfil (+3 more)

### Community 98 - "vite.config.ts"
Cohesion: 0.18
Nodes (10): @tailwindcss/vite@^4.2.1, vite-tsconfig-paths@^6.0.2, nitro@3.0.260603-beta, vite@^8.0.16, @vitejs/plugin-react@^5.2.0, nitro, @tailwindcss/vite, vite (+2 more)

### Community 99 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 100 - "permissions.test.ts"
Cohesion: 0.20
Nodes (10): groupAllowedByLegacy(), AccessContext, ASSIGNABLE_ROLES, chapterY, comum, ctx(), elevatedOnlyInX, screen() (+2 more)

### Community 101 - "Tutorial: sua primeira contribuição"
Cohesion: 0.20
Nodes (10): 1. Fork do repositório, 2. Clone o seu fork, 3. Crie um branch, 4. Faça a alteração, 5. Adicione e faça o commit, 6. Envie o branch para o seu fork, 7. Abra o Pull Request, Antes de marcar o PR como pronto (+2 more)

### Community 102 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 103 - "Templo Virtual — Guia do Usuário"
Cohesion: 0.22
Nodes (9): Como funciona o acesso, Cuidado com os dados pessoais, Glossário, Manutenção deste guia, O que cada cargo pode fazer, O que é o Templo Virtual, Para quem é, Perguntas frequentes (+1 more)

### Community 104 - "6. Modelo de dados"
Cohesion: 0.22
Nodes (9): 6. Modelo de dados, Calendário, presenças e atas, Comissões, Convenções do schema, Eventos de arrecadação (distintos de `calendar_events`), Finanças, Governança, Identidade e multi-inquilino (+1 more)

### Community 105 - "MyCadastroPanel.tsx"
Cohesion: 0.25
Nodes (8): 8. PII e LGPD, GUARDIAN_RELATIONSHIPS, EditableGuardian, ReadonlyRow(), formatCpfMask(), formatRgMask(), MyCadastroGuardian, MyCadastroMember

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

### Community 113 - "permissions-sql-parity.test.ts"
Cohesion: 0.25
Nodes (5): Permission, CHECKED, MIGRATIONS, ROLES, sql

### Community 114 - "Checklist manual — RBAC por papel (capítulo ativo)"
Cohesion: 0.33
Nodes (5): Assinaturas oficiais, Cadastro global, Checklist manual — RBAC por papel (capítulo ativo), Escopo de capítulo (multifiliação), Testes automatizados da matriz

### Community 115 - "Documentação — Templo Virtual"
Cohesion: 0.33
Nodes (6): Checklist rápido antes de abrir o PR, Discussão interna (fora do app), Documentação — Templo Virtual, Os três documentos, Qual documento atualizar, Regra de manutenção da documentação

### Community 117 - "commissions.functions.ts"
Cohesion: 0.40
Nodes (5): isLinkedAdvisoryCouncil(), listMyCommissions, MyCommission, ADVISORY_COUNCIL_ACCOUNT_ROLES, ADVISORY_COUNCIL_POSITION_CODES

### Community 118 - "sphere-members.functions.ts"
Cohesion: 0.40
Nodes (5): Realm, ChapterJoin, CrossRealmFicha, getMyCrossRealmFichas, mapRow()

### Community 119 - "QrScanner.tsx"
Cohesion: 0.40
Nodes (3): html5-qrcode@^2.3.8, html5-qrcode, QrScanner()

### Community 120 - "input-otp.tsx"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 121 - "router.tsx"
Cohesion: 0.40
Nodes (4): getRouter(), Register, routeTree, startInstance

### Community 122 - "documentacao/index.tsx"
Cohesion: 0.50
Nodes (3): DOCS_CATEGORIES, DocumentacaoHub(), Route

### Community 123 - "minute-pdf.ts"
Cohesion: 0.67
Nodes (3): exportMinutePdf(), fileSafe(), MinutePdfInput

### Community 124 - "oficio-signatures.ts"
Cohesion: 0.50
Nodes (3): loadOficioSignatureMap(), OFICIO_PDF_SIGNATURE_CODES, OficioSignatureSlot

### Community 125 - "vite-env.d.ts"
Cohesion: 0.50
Nodes (3): ImportMeta, ImportMetaEnv, *.md?raw

## Knowledge Gaps
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `membros.$id.tsx`, `calendar.tsx`, `MinuteBodyEditor.tsx`, `Button`, `PageHeader`, `SindicanciaAtaForm.tsx`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `eventos.$id.tsx`, `AppShell.tsx`, `SelectContent`, `events.functions.ts`, `Badge`, `docs-catalog.ts`, `atas.tsx`, `regional.calendario.tsx`, `tesouraria.fluxo.tsx`, `configuracoes-globais.cargos.tsx`, `utils.ts`, `formatBRL`, `MinutesPanel.tsx`, `ChapterAuditPanel.tsx`, `regional.membros.tsx`, `regional.aparencia.tsx`, `TicketSellerRanking.tsx`, `HubLanding.tsx`, `menubar.tsx`, `SearchableSelect`, `class-variance-authority`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `SupademoEmbed.tsx`, `form.tsx`, `chart.tsx`, `pagination.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `input-otp.tsx`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Should `membros.$id.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.04910891089108911 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `membros.$id.tsx`, `calendar.tsx`, `cn`, `MinuteBodyEditor.tsx`, `Button`, `PageHeader`, `SindicanciaAtaForm.tsx`, `calendario.tsx`, `sindicancias.sindicarias.tsx`, `investigations.functions.ts`, `eventos.$id.tsx`, `AppShell.tsx`, `SelectContent`, `events.functions.ts`, `sindicancias.fichas.tsx`, `accounts.functions.ts`, `Badge`, `docs-catalog.ts`, `atas.tsx`, `event-finance.functions.ts`, `dependencies`, `regional.calendario.tsx`, `tesouraria.fluxo.tsx`, `MemberFields.tsx`, `org-join-request.functions.ts`, `@tanstack/react-router`, `useActiveChapter`, `tesouraria.cobrancas.tsx`, `tesouraria.mensalidades.tsx`, `configuracoes.tsx`, `org.functions.ts`, `configuracoes-globais.cargos.tsx`, `utils.ts`, `formatBRL`, `package.json`, `auth-nav-cache.ts`, `MinutesPanel.tsx`, `office-signatures.functions.ts`, `ChapterAuditPanel.tsx`, `ActiveChapterContext.tsx`, `PresencasAnalytics.tsx`, `regional.membros.tsx`, `regional.aparencia.tsx`, `ata.$token.tsx`, `format.ts`, `calendar-types.ts`, `presencas.tsx`, `__root.tsx`, `TicketSellerRanking.tsx`, `HubLanding.tsx`, `ongoing.$id.tsx`, `menubar.tsx`, `SearchableSelect`, `class-variance-authority`, `ThemeToggle`, `carousel.tsx`, `CarteirinhaProficiencia.tsx`, `SupademoEmbed.tsx`, `form.tsx`, `chart.tsx`, `pagination.tsx`, `MyCadastroPanel.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `QrScanner.tsx`, `input-otp.tsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Should `routeTree.gen.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Why does `Documentação técnica — Templo Virtual` connect `Documentação técnica — Templo Virtual` to `6. Modelo de dados`, `MyCadastroPanel.tsx`, `OPEN-SOURCE.md`, `AppShell.tsx`, `finance-xlsx.ts`, `ActiveChapterContext.tsx`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.04196738839882384 - nodes in this community are weakly interconnected._
- **Should `MinuteBodyEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0517503805175038 - nodes in this community are weakly interconnected._