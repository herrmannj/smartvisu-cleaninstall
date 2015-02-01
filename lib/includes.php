<?php
/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU
 * @author      Martin Gleiß
 * @copyright   2012
 * @license     GPL [http://www.gnu.de]
 * -----------------------------------------------------------------------------
 */


/**
 * Path of system-directory
 */
define ('const_path_system', dirname(__FILE__).'/');

/**
 * Path of smartVISU
 */
define ('const_path', substr(const_path_system, 0, -4));

/**
 * Load default-config and individual config

if (is_file(const_path.'config.php')) require_once const_path.'config.php';
require_once const_path_system.'defaults.php';
*/

require_once const_path_system.'functions_config.php';
$cfg = new config(const_path.'config.ini');
$cfg -> load_config();

/**
 * Include main-functions
 */
require_once const_path_system.'functions.php';

?>
