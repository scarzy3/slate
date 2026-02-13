import AlertsPanel from '../../../components/AlertsPanel.jsx';

function ActiveAlertsWidget({ analytics, kits, settings, onNavigate, onFilterKits, requests, personnel, curUserId }) {
  return <AlertsPanel analytics={analytics} kits={kits} settings={settings} onNavigate={onNavigate} onFilterKits={onFilterKits} requests={requests} personnel={personnel} curUserId={curUserId} />;
}

export default ActiveAlertsWidget;
