import QuickActions from '../../../components/QuickActions.jsx';

function QuickActionsWidget({ kits, curUserId, personnel, onAction, favorites, setFavorites }) {
  return <QuickActions kits={kits} curUserId={curUserId} personnel={personnel} onAction={onAction}
    favorites={favorites} onToggleFav={id => setFavorites(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])} />;
}

export default QuickActionsWidget;
