import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/home/home').then((m) => m.Home),
      },
      {
        path: 'receipts',
        loadComponent: () =>
          import('./features/movements/receipts/receipts-list/receipts-list').then((m) => m.ReceiptsList),
      },
      {
        path: 'receipts/new',
        loadComponent: () =>
          import('./features/movements/receipts/receipt-supplier-picker/receipt-supplier-picker').then(
            (m) => m.ReceiptSupplierPicker
          ),
      },
      {
        path: 'receipts/new/details',
        loadComponent: () =>
          import('./features/movements/receipts/receipt-create/receipt-create').then((m) => m.ReceiptCreate),
      },
      {
        path: 'issues',
        loadComponent: () =>
          import('./features/movements/issues/issues-list/issues-list').then((m) => m.IssuesList),
      },
      {
        path: 'issues/new',
        loadComponent: () =>
          import('./features/movements/issues/issue-client-picker/issue-client-picker').then(
            (m) => m.IssueClientPicker
          ),
      },
      {
        path: 'issues/new/details',
        loadComponent: () =>
          import('./features/movements/issues/issue-create/issue-create').then((m) => m.IssueCreate),
      },
      {
        path: 'issues/void-requests',
        loadComponent: () =>
          import('./features/movements/issue-void-requests/issue-void-requests-list/issue-void-requests-list').then(
            (m) => m.IssueVoidRequestsList
          ),
      },
      {
        path: 'receipts/void-requests',
        loadComponent: () =>
          import(
            './features/movements/receipt-void-requests/receipt-void-requests-list/receipt-void-requests-list'
          ).then((m) => m.ReceiptVoidRequestsList),
      },
      {
        path: 'account-receivables',
        loadComponent: () =>
          import('./features/movements/account-receivables/account-receivables-list/account-receivables-list').then(
            (m) => m.AccountReceivablesList
          ),
      },
      {
        path: 'reports/financial-dashboard',
        loadComponent: () => import('./features/reports/reports-home/reports-home').then((m) => m.ReportsHome),
      },
      {
        path: 'reports/stock',
        loadComponent: () => import('./features/reports/stock-report/stock-report').then((m) => m.StockReport),
      },
      {
        path: 'reports/stock-by-department',
        loadComponent: () =>
          import('./features/reports/stock-by-department-report/stock-by-department-report').then(
            (m) => m.StockByDepartmentReport
          ),
      },
      {
        path: 'reports/kardex',
        loadComponent: () => import('./features/reports/kardex-report/kardex-report').then((m) => m.KardexReport),
      },
      {
        path: 'reports/inventory-count',
        loadComponent: () =>
          import('./features/reports/inventory-count-report/inventory-count-report').then(
            (m) => m.InventoryCountReport
          ),
      },
      {
        path: 'reports/issues',
        loadComponent: () => import('./features/reports/issues-report/issues-report').then((m) => m.IssuesReport),
      },
      {
        path: 'reports/receipts',
        loadComponent: () =>
          import('./features/reports/receipts-report/receipts-report').then((m) => m.ReceiptsReport),
      },
      {
        path: 'reports/kardex-by-product',
        loadComponent: () =>
          import('./features/reports/kardex-by-product-report/kardex-by-product-report').then(
            (m) => m.KardexByProductReport
          ),
      },
      {
        path: 'reports/pastor-field',
        loadComponent: () =>
          import('./features/reports/pastor-field-report/pastor-field-report').then((m) => m.PastorFieldReport),
      },
      {
        path: 'reports/account-receivables',
        loadComponent: () =>
          import('./features/reports/account-receivables-report/account-receivables-report').then(
            (m) => m.AccountReceivablesReport
          ),
      },
      {
        path: 'portal/my-account',
        loadComponent: () => import('./features/portal/my-account/my-account').then((m) => m.MyAccount),
      },
      {
        path: 'transfers/new',
        loadComponent: () =>
          import('./features/movements/transfers/transfer-create/transfer-create').then((m) => m.TransferCreate),
      },
      {
        path: 'transfers/sent',
        loadComponent: () =>
          import('./features/movements/transfers/transfers-sent-list/transfers-sent-list').then(
            (m) => m.TransfersSentList
          ),
      },
      {
        path: 'transfers/received',
        loadComponent: () =>
          import('./features/movements/transfers/transfers-received-list/transfers-received-list').then(
            (m) => m.TransfersReceivedList
          ),
      },
      {
        path: 'transfers/received/new',
        loadComponent: () =>
          import('./features/movements/transfers/transfer-receive-create/transfer-receive-create').then(
            (m) => m.TransferReceiveCreate
          ),
      },
      {
        path: 'catalogs/clients',
        loadComponent: () =>
          import('./features/catalogs/clients/clients-list/clients-list').then((m) => m.ClientsList),
      },
      {
        path: 'catalogs/clients/pastors-pending',
        loadComponent: () =>
          import('./features/catalogs/clients/pastors-pending-list/pastors-pending-list').then(
            (m) => m.PastorsPendingList
          ),
      },
      {
        path: 'catalogs/suppliers',
        loadComponent: () =>
          import('./features/catalogs/suppliers/suppliers-list/suppliers-list').then((m) => m.SuppliersList),
      },
      {
        path: 'catalogs/products',
        loadComponent: () =>
          import('./features/catalogs/products/products-list/products-list').then((m) => m.ProductsList),
      },
      {
        path: 'geography/districts',
        loadComponent: () =>
          import('./features/catalogs/districts/districts-list/districts-list').then((m) => m.DistrictsList),
      },
      {
        path: 'geography/churches',
        loadComponent: () =>
          import('./features/catalogs/churches/churches-list/churches-list').then((m) => m.ChurchesList),
      },
      {
        path: 'admin/roles',
        loadComponent: () => import('./features/admin/roles/roles-list/roles-list').then((m) => m.RolesList),
      },
      {
        path: 'admin/permissions',
        loadComponent: () =>
          import('./features/admin/permissions/permissions-list/permissions-list').then((m) => m.PermissionsList),
      },
      {
        path: 'admin/users',
        loadComponent: () => import('./features/admin/users/users-list/users-list').then((m) => m.UsersList),
      },
      {
        path: 'admin/lookup/:slug',
        loadComponent: () =>
          import('./features/admin/lookup-catalogs/lookup-catalog-list/lookup-catalog-list').then(
            (m) => m.LookupCatalogList
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/error-state/error-state').then((m) => m.ErrorState),
    data: { code: 404 },
  },
];
