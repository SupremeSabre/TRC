<?php
/**
 * @copyright Copyright(c) 2016 google.com
 * @file _initData.php
 * @brief 初始化数据
 * @author nswe
 * @date 2016/6/8 10:08:23
 * @version 4.5
 */
class _initData extends pluginBase
{
	public function reg()
	{
		//防止回倒按钮引起的重复提交订单
		plugin::reg("onFinishView@simple@cart3",function()
		{
			$backUrl = IUrl::creatUrl('/ucenter/order');
echo <<< EOF
<script type="text/javascript">
if(history.replaceState)
{
	history.replaceState(null, null, "{$backUrl}");
}
</script>
EOF;
		});

		//促销规则
		plugin::reg("onFinishView@simple@cart",function()
		{
			$promotionData = self::controller()->promotion;
			if(!$promotionData)
			{
				return;
			}

			$promotionData = JSON::encode($promotionData);
echo <<< EOF
<script type="text/javascript">
$(function()
{
	var promotionData = {$promotionData};
	if(promotionData)
	{
		for(var i in promotionData)
		{
			$('#cart_prompt_box').append( template.render('promotionTemplate',{"item":promotionData[i]}) );
		}
		$('#cart_prompt').show();
	}
});
</script>
EOF;
		});

		plugin::reg("onCreateController",$this,"webSiteConfig");
		plugin::reg("onFinishView",$this,"jsGlobal");
		plugin::reg("onBeforeCreateAction@block@orderCheck",function(){
			self::controller()->orderCheck = function()
			{
				$orderNo = IFilter::act(IReq::get('order_no'));

				//充值方式
				if(stripos($orderNo,'recharge') !== false)
				{
					$tradenoArray = explode('recharge',$orderNo);
					$recharge_no  = isset($tradenoArray[1]) ? $tradenoArray[1] : 0;
					$rechargeObj = new IModel('online_recharge');
					$rechargeRow = $rechargeObj->getObj('recharge_no = "'.$recharge_no.'"','status');
					if($rechargeRow && isset($rechargeRow['status']) && $rechargeRow['status'] == 1)
					{
						die(JSON::encode(array('result' => 1)));
					}
				}
				else
				{
					$orderDB = new IModel('order');
					$orderRow= $orderDB->getObj('order_no = "'.$orderNo.'"','pay_status');
					if($orderRow && isset($orderRow['pay_status']) && $orderRow['pay_status'] == 1)
					{
						die(JSON::encode(array('result' => 1)));
					}
				}
				die(JSON::encode(array('result' => 0)));
			};
		});
	}

	//初始化网站配置数据
	public function webSiteConfig()
	{
		$configObj = new Config("site_config");
		self::controller()->_siteConfig = $configObj;
	}

	//初始化js全局变量
	public function jsGlobal()
	{
		//全局JS提示信息
		$_msg = IReq::get('_msg') ? IFilter::act(IReq::get('_msg')) : "";
		if($_msg)
		{
			//默认语言包
			$msgArray = array(
				"success" => "操作成功",
				"fail"    => "操作失败",
			);
			$_msg = isset($msgArray[$_msg]) ? $msgArray[$_msg] : $_msg;
			if($_msg)
			{
echo <<< EOF
<script type="text/javascript">
alert("{$_msg}");
</script>
EOF;
			}
		}

		//全局JS函数和变量
		$url       = IUrl::creatUrl('_controller_/_action_/_paramKey_/_paramVal_');
		$themePath = IWeb::$app->getController()->getWebViewPath();
		$skinPath  = IWeb::$app->getController()->getWebSkinPath();
		$webroot   = IUrl::creatUrl();

echo <<< EOF
<script type="text/javascript">
_webUrl = "$url";_themePath = "$themePath";_skinPath = "$skinPath";_webRoot = "$webroot";
</script>
EOF;
	}
}