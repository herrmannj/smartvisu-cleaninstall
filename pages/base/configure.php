<?php
/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU
 * @author      Joerg Herrmann
 * @copyright   2014
 * @license     GPL [http://www.gnu.de]
 * -----------------------------------------------------------------------------
 */

//error_reporting( E_ALL | E_STRICT );
error_reporting(E_ALL & ~E_NOTICE);
ini_set("display_errors", 1);

preg_match('/(.*)?\/pages\/.*?/', dirname(__FILE__), $system_path);
define ('const_path_system', $system_path[1].'/lib/');
define ('const_path', $system_path[1].'/');

$request = array_merge($_GET, $_POST);
//touch(const_path.'config.ini');

require_once const_path_system.'functions_config.php';
$cfg = new config(const_path.'config.ini');
$cfg -> load_config();
$cfg -> write_config($request);

// management interface, 
if ($request['managed'] !== '')
{
  die;
}
else
{
  //$cfg -> write_config($request);
	//header("HTTP/1.0 600 smartVISU Config Error");

	//$ret[] = array('title' => 'Configuration',
	//	'text' => 'Error saving configuration!<br />Please check the file permissions on "config.php" (it must be writeable)!');

	//echo json_encode($ret);
}

?>
