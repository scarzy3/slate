import { T } from '../../theme/theme.js';
import Bg from './Bg.jsx';

function DeptBg({dept}){if(!dept)return null;return <Bg color={dept.color||T.mu} bg={(dept.color||T.mu)+"18"}>{dept.name}</Bg>;}

export default DeptBg;
