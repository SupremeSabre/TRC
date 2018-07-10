<?php
/**
 * @brief 升级更新控制器
 */
class Update extends IController
{
	/**
	 * @brief iwebshop5.0 版本升级更新
	 */
	public function index()
	{
		set_time_limit(0);

		//删除插件scws和boson
		$pluginDB = new IModel('plugin');
		$pluginDB->del('class_name in ("bosonWords","words")');

		$sql = array(
			"INSERT INTO `{pre}payment` VALUES (NULL, '微信H5支付', 1, 'h5_wechat', '微信H5支付接口，去微信商户管理中心申请。<a href=\"https://pay.weixin.qq.com/\" target=\"_blank\">立即申请</a>', '/payments/logos/pay_h5_wechat.jpg', 1, 99, NULL, 0.00, 1, NULL,2);",
			"DROP TABLE IF EXISTS `{pre}delivery_trace`;",
			"CREATE TABLE `{pre}delivery_trace` (
			  `delivery_code` varchar(30) default NULL COMMENT '快递单号',
			  `content` text COMMENT '物流跟踪信息',
			  PRIMARY KEY  (`delivery_code`)
			) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COMMENT='订单物流跟踪表';",
			"ALTER TABLE `{pre}delivery_doc` ADD INDEX (`delivery_code`);",
			"ALTER TABLE `{pre}delivery_trace` ADD foreign key(delivery_code) references `{pre}delivery_doc`(delivery_code) ON UPDATE CASCADE ON DELETE CASCADE;",
			"ALTER TABLE `{pre}goods_car` ADD `unselected` TEXT NOT NULL COMMENT '未选择结算的商品信息';",
			"DROP TABLE IF EXISTS `{pre}invoice`;",
			"CREATE TABLE `{pre}invoice` (
			  `id` int(11) unsigned NOT NULL auto_increment,
			  `user_id` int(11) unsigned default NULL COMMENT '用户id',
			  `type` tinyint(1) NOT NULL default '1' COMMENT '发票类型,1:普通发票,2:增值税专用发票',
			  `company_name` varchar(80) NOT NULL COMMENT '单位名称',
			  `taxcode` varchar(30) NOT NULL COMMENT '纳税人识别码',
			  `address` varchar(100) default NULL COMMENT '注册地址',
			  `telphone` varchar(20) default NULL COMMENT '注册电话',
			  `bankname` varchar(80) default NULL COMMENT '开户银行',
			  `bankno` varchar(30) default NULL COMMENT '银行账户',
			  PRIMARY KEY  (`id`),
			  index (`user_id`)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='发票表';",
			"ALTER TABLE `{pre}invoice` ADD foreign key(user_id) references `{pre}user`(id) ON UPDATE CASCADE ON DELETE CASCADE;",
			"ALTER TABLE `{pre}order` ADD `invoice_info` text  COMMENT '发票信息JSON数据';",
		);

		//清理特价活动
		$this->sale_del();

		//判断是否已经存在微信H5支付
		$paymentDB = new IModel('payment');
		$paymentRow= $paymentDB->getObj('class_name = "h5_wechat"');
		if($paymentRow)
		{
			unset($sql[0]);
		}

		foreach($sql as $key => $val)
		{
			IDBFactory::getDB()->query( $this->_c($val) );
		}

		die("升级成功!! V5.0版本");
	}

	public function _c($sql)
	{
		return str_replace('{pre}',IWeb::$app->config['DB']['tablePre'],$sql);
	}

	//[特价商品]删除
	public function sale_del()
	{
		$proObj = new IModel('promotion');

		//恢复特价商品价格
		$proList = $proObj->query("award_type = 7");
		foreach($proList as $key => $val)
		{
			if($val['is_close'] == 0)
			{
				$tempUpdate = JSON::decode($val['intro']);
				if($tempUpdate)
				{
					foreach($tempUpdate as $gid => $g_discount)
					{
						goods_class::goodsDiscount($gid,$g_discount,"constant","add");
					}
				}
			}
		}
		$proObj->del("award_type = 7");
	}
}