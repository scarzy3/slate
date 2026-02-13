import ActivityFeed from '../../../components/ActivityFeed.jsx';

function ActivityFeedWidget({ logs, kits, personnel }) {
  return <ActivityFeed logs={logs} kits={kits} personnel={personnel} limit={8} />;
}

export default ActivityFeedWidget;
